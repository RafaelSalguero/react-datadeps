import { PropDependencies, PromiseResult, AsyncPropQuery } from "./types"
import { ChangePromise, extractParamValues, getEffectiveProps, getNextStateFromChange, iterate, propsState, IterateResult, Mixer } from "./logic";
import { State } from "./state";
import { sequenceEquals } from "keautils";

/**Despacha una promesa mezclando la información de su resultado con el estado actual. Devuelve un nuevo estado si la promesa si modificó el estado y se debe de 
 * realizar un chequeo de cambio. Devuelve null si la promesa no afecto al estado y no se debe de realizar un chequeo
 */
function getNextStateFromPromise<TProps>(
    externalProps: Partial<TProps>,
    allPropsFromDeps: (keyof TProps)[],
    state: State<TProps>,
    deps: PropDependencies<TProps>,
    change: PromiseResult<TProps[keyof TProps]>,
    original: ChangePromise<TProps>,
    mixer: Mixer<TProps>
): State<TProps> | null {

    const dep = deps[original.prop] as AsyncPropQuery<TProps, TProps[keyof TProps]>;
    const actualProps = getEffectiveProps(externalProps, allPropsFromDeps, state.propsState, mixer);
    const actualParams = extractParamValues(actualProps, dep.params);
    const originalParams = original.params;

    //Actualizamos el state con la información de la promesa, y realizamos de nuevo el chequeo, siempre y cuando los parametros originales y los 
    //actuales sean consistenates
    if (sequenceEquals(actualParams, originalParams)) {
        const newState = { ...state, propsState: getNextStateFromChange(state.propsState, original.prop, change) };
        return newState;
    }
    return null;
}

/**Despacha las promesas pendientes y revisa si hay un estado consistente interno de los props, si es así publica un nuevo objeto pros */
function checkChange<TProps>(
    externalProps: Partial<TProps>,
    allPropsFromDeps: (keyof TProps)[],
    iterateResult: IterateResult<TProps>,
    dispatchPromise: (promResult: PromiseResult<TProps[keyof TProps]>, original: ChangePromise<TProps>) => void,
    resolve: (props: TProps | undefined, status: "done" | "error" | "pending") => void,
    mixer: Mixer<TProps>
) {

    //Despachamos todas las promesas:
    for (const prom of iterateResult.promises) {
        prom.promise.then(promResult => dispatchPromise(promResult, prom));
    }

    //Publicamos los nuevos props:
    const currentStatus = propsState(iterateResult.state.propsState);
    if (currentStatus == "done") {
        //Extraemos las propiedades: 
        const effectiveProps = getEffectiveProps(externalProps, allPropsFromDeps, iterateResult.state.propsState, mixer);
        resolve(effectiveProps as TProps, "done");
    } else {
        resolve(undefined, currentStatus);
    }
}

/**Dadas las propiedades iniciales, resuelve las dependencias de información dadas por deps y devuelve los props resueltos en la función resolve.
 * Devuelve una función que notifica de un cambio de las propiedades externas.
 */
export function getNextState<TProps>(
    initialProps: Partial<TProps>,
    deps: PropDependencies<TProps>,
    resolve: (props: TProps | undefined, status: "done" | "error" | "pending") => void,
    mixer: Mixer<TProps>
): (nextProps: Partial<TProps>) => void {
    const allPropsFromDeps = Object.keys(deps) as (keyof TProps)[];

    let promises: ChangePromise<TProps>[] = [];
    let state: State<TProps> = { lastProps: undefined, propsState: {} };
    let externalProps = initialProps;

    function dispatchPromise(change: PromiseResult<TProps[keyof TProps]>, original: ChangePromise<TProps>) {
        const nextState = getNextStateFromPromise(
            externalProps,
            allPropsFromDeps,
            state,
            deps,
            change,
            original,
            mixer
        );

        //Eliminamos esta promesa de las promesas pendientes:
        promises = promises.filter(x => x != original);
        //Actualizamos el state si es que cambio:
        if (nextState) {
            state = nextState;
            //Iniciamos el ciclo de chequeo otra vez, esto se seguira repitiendo hasta que ya no existan mas promesas pendientes
            check();
        }
    }

    function dispatchChange(nextProps: TProps) {
        externalProps = nextProps;
        check();
    }

    /**Forza el refrescado de una propiedad */
    function refresh(prop: keyof TProps) {
        return check(prop);
    }

    /**Revisa si hay cambios pendientes. Devuelve una promesa que se termina cuando todas las promesas pendientes terminan */
    function check(forceUpdate?: keyof TProps): PromiseLike<void> {
        const result = iterate(externalProps, deps, state, forceUpdate, refresh, mixer);
        checkChange(
            externalProps,
            allPropsFromDeps,
            result,
            dispatchPromise,
            resolve,
            mixer
        );

        state = result.state;
        promises = [...promises, ...result.promises];

        return Promise.all(promises.map(x => x.promise)).then(() => { });
    }

    //Iniciamos el ciclo:
    check();

    return dispatchChange;
}