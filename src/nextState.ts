import { PropDependencies, PromiseResult, AsyncPropQuery } from "./types"
import { ChangePromise, extractParamValues, getEffectiveProps, getNextStateFromChange, iterate, propsStateAllDone, IterateResult } from "./logic";
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
    original: ChangePromise<TProps>): State<TProps> | null {

    const dep = deps[original.prop] as AsyncPropQuery<TProps, TProps[keyof TProps]>;
    const actualProps = getEffectiveProps(externalProps, allPropsFromDeps, state.propsState);
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
    resolve: (props: TProps) => void) {

    //Despachamos todas las promesas:
    for (const prom of iterateResult.promises) {
        prom.promise.then(promResult => dispatchPromise(promResult, prom));
    }

    //Publicamos los nuevos props:
    if (propsStateAllDone(iterateResult.state.propsState)) {
        //Extraemos las propiedades: 
        const effectiveProps = getEffectiveProps(externalProps, allPropsFromDeps, iterateResult.state.propsState);
        resolve(effectiveProps as TProps);
    }
}

/**Dadas las propiedades iniciales, resuelve las dependencias de información dadas por deps y devuelve los props resueltos en la función resolve.
 * Devuelve una función que notifica de un cambio de las propiedades externas.
 */
export function getNextState<TProps>(initialProps: Partial<TProps>, deps: PropDependencies<TProps>, resolve: (props: TProps) => void): (nextProps: Partial<TProps>) => void {
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
            original
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
        check(prop);
    }

    function check(forceUpdate?: keyof TProps) {
        const result = iterate(externalProps, deps, state, forceUpdate, refresh);
        checkChange(
            externalProps,
            allPropsFromDeps,
            result,
            dispatchPromise,
            resolve
        );

        state = result.state;
        promises = [...promises, ...result.promises];
    }

    //Iniciamos el ciclo:
    check();

    return dispatchChange;
}