import { PropQuery, PromiseResult, PropDependencies, AsyncPropQuery, QueryParams } from "./types";
import { any, all, sequenceEquals, toMap } from "keautils";
import { propPendingValue, PropsState, PerPropState, State } from "./state";

type PropKeyDependencies<TProps> = {[K in keyof TProps]?: (keyof TProps)[]};
/**Obtiene los nombres de las propiedades que son diferentes entre 2 objetos */
function diffObject<T>(a: T, b: T): (keyof T)[] {
    //Todas las propiedades entre a y b
    const allProps = [... new Set([...Object.keys(a), ...Object.keys(b)])] as (keyof T)[];
    //Devolevemos solo las que son diferentes:
    return allProps.filter(prop => a[prop] !== b[prop]);
}


function IsAsyncPropQuery<TProps, TProp>(dep: PropQuery<TProps, TProp> | undefined): dep is AsyncPropQuery<TProps, TProp> {
    return dep ? (dep as AsyncPropQuery<TProps, TProp>).async : false;
}

/**Determina si se debe de actualizar el valor de una propiedad dados los parametros siguientes y 
 * los anteriores, se considera como valor especial al propPendingValue. Si la propiedad se debe de actualizar devuelve "update", si no,
 * devuelve "nothingChanged" si ninguna de sus dependencias cambio así que no se debe de actualizar, o "pendingDeps" si alguna de sus dependencias
 * aún esta pendiente de actualizar y por eso no se debe de actualizar
 */
function shouldUpdate(nextParams: any[], lastStateParams: any[] | undefined): "update" | "nothingChanged" | "pendingDeps" {
    const anyPending = any(nextParams, x => x == propPendingValue);
    if (anyPending) return "pendingDeps";

    const change = lastStateParams == undefined || !sequenceEquals(lastStateParams, nextParams);
    return change ? "update" : "nothingChanged";
}


export interface PropUpdate<T> {
    /**Resultado de la actualización de la propiedad */
    result: PromiseResult<T>;
    /**Parametros con los cuáles se actualizó la propiedad */
    params: any[];
}
export type PropUpdates<TProps> = {[K in keyof TProps]?: PropUpdate<TProps[K]> };

interface InitialPropStateResult<TProp> {
    value: PerPropState<TProp>;
    /**Promesa si es que el valor es asíncrono */
    promise?: PromiseLike<PropUpdate<TProp>>;
}

/**Obtiene el valor efectivo de una propiedad */
function getEffectivePropValue<TProps, Key extends keyof TProps>(prop: Key, externalProps: Partial<TProps>, state: PerPropState<TProps[Key]>) {
    if (externalProps[prop]) {
        return externalProps[prop];
    } else {
        return state.status == "done" ? state.lastQueryResult : propPendingValue;
    }
}

function getEffectiveProps<TProps>(externalProps: Partial<TProps>, allPropsFromDeps: (keyof TProps)[], state: PropsState<TProps>): Partial<TProps> {
    const stateProps = toMap(allPropsFromDeps
        .map(x => ({ key: x, value: state[x] }))
        .map(x => ({ ...x, value: x.value && x.value.status == "done" ? x.value.lastQueryResult : propPendingValue })),
        x => x.key,
        x => x.value);

    const result = { ...stateProps, ... (externalProps as any) };

    return result;
}

/**Obtiene el estado inicial para una de las propiedades. Devuelve una promesa como parte del resultado en caso de que la propiedad sea
 * asíncrona */
function getInitialStateSingleProp<TProps, TProp>(params: QueryParams<TProps>, dep: PropQuery<TProps, TProp>): InitialPropStateResult<TProp> {
    const lastParams = (dep.params || []).map(key => params.props[key]);
    if (IsAsyncPropQuery<TProps, TProp>(dep)) {
        const promise = dep.query(params.props as TProps, params.refresh!);
        const props = params.props;
        const depParams = dep.params || [];
        const nextParams = depParams.map(key => params.props[key]);

        const promiseResult: PromiseLike<PropUpdate<TProp>> = promise
            .then(success => ({ status: "done", value: success }), error => ({ status: "error", error: error } as PromiseResult<TProp>))
            .then(x => ({ result: x, params: nextParams } as PropUpdate<TProp>))

        return {
            value: {
                status: "pending",
                lastParams: lastParams,
            },
            promise: promiseResult
        };
    } else {
        const result = dep.query(params.props as TProps, params.refresh!);
        return {
            value: {
                status: "done",
                lastQueryResult: result,
                lastParams: lastParams
            }
        };
    }
}

export interface InitialStateResult<TProps> {
    /**El nuevo state */
    state: State<TProps>;
    /**Una promesa que se debe de atender cuando se resuelva para obtener un siguiente state o null en caso de que el estado no necesite de promesas para ser resuelto */
    promise: PromiseLike<PropUpdates<TProps>> | null;
    /**True si el estado fue actualizado de manera sincrona, lo que indica que inmediatamente se debe de intentar actualizar de nuevo*/
    hadSyncUpdates: boolean;
}

function promiseResultToState<T>(result: PromiseResult<T>, lastParams: any[]): PerPropState<T> {
    switch (result.status) {
        case "done":
            return {
                status: "done",
                lastParams: lastParams,
                lastQueryResult: result.value
            };
        case "error":
            return {
                status: "error",
                lastParams: lastParams,
                error: result.error
            }
    }
}

export function getNextStateFromChange<TProps>(lastState: PropsState<TProps>, change: PropUpdates<TProps>): PropsState<TProps> {
    const updates = Object.keys(change).map(key => ({ key: key, value: change[key]!, state: lastState[key] }));
    const states = updates.map(x => ({ ...x, value: promiseResultToState(x.value.result, (x.state && x.state.lastParams || [])) }))
    const stateMap = toMap(states, x => x.key, x => x.value);
    const result = Object.assign({}, lastState, stateMap);
    return result;
}

/**Obtiene el estado inicial de todas las propiedades. Devuelve una promisa que se resuelve cuando todas las propiedades asíncronas han sido resueltas, y que
 * incluye los resultados de la resolución de esas propiedades
 */
export function getNextStateIteration<TProps>(externalProps: Partial<TProps>, deps: PropDependencies<TProps>, lastState: PropsState<TProps>): InitialStateResult<TProps> {
    const allPropsFromDeps = Object.keys(deps) as (keyof TProps)[];
    const params: QueryParams<TProps> = {
        props: getEffectiveProps(externalProps, allPropsFromDeps, lastState)
    };
    type PerPropResult = {[K in keyof TProps]?: InitialPropStateResult<TProps[K]> };
    const perProp: PerPropResult = {};

    //Formamos el objeto que contiene todas las propiedades por promesa:
    const promises: PromiseLike<{ result: PropUpdate<TProps[keyof TProps]>, prop: keyof TProps }>[] = [];
    const resultValue: State<TProps> = { lastProps: params.props, propsState: {} };

    let hadSyncUpdates: boolean = false;
    for (const prop of allPropsFromDeps) {
        const dep = deps[prop];
        if (dep) {
            const depParams = dep.params || [];
            const nextParams = depParams.map(key => params.props[key]);
            const lastStateProp = lastState[prop];
            const lastParams = lastStateProp && lastStateProp.lastParams;
            const update = shouldUpdate(nextParams, lastParams);

            const result: InitialPropStateResult<TProps[keyof TProps]> =
                update == "update" ? getInitialStateSingleProp<TProps, TProps[keyof TProps]>(params, dep) :
                    (update == "nothingChanged" && lastStateProp) ? { value: lastStateProp } :
                        (update == "pendingDeps") ? { value: { status: "pending", lastParams: (lastStateProp && lastStateProp.lastParams) } } : null as never;

            if (update == "update" && result.value.status == "done") {
                hadSyncUpdates = true;
            }
            perProp[prop] = result;
            resultValue.propsState[prop] = result.value;
            if (result.promise) {
                const prom = result.promise.then(x => ({ result: x, prop: prop, value: result.value }));
                promises.push(prom);
            }
        }
    }

    const allProm = promises.length > 0 ? Promise.all(promises).then(results =>
        toMap(results, x => x.prop, x => x.result) as any as {[K in keyof TProps]?: PropUpdate<TProps[K]>}) : null;

    const result: InitialStateResult<TProps> = {
        promise: allProm,
        state: resultValue,
        hadSyncUpdates: hadSyncUpdates
    };

    return result;
}


interface IterateResult<TProps> {
    state: State<TProps>;
    promises: PromiseLike<PropUpdates<TProps>>[];
}

/**Itera obteniendo el siguiente state con getNextStateIteration hasta que ya no hay actualizaciones síncronas, y devuelve un arreglo con las promesas
 * de las actualizaciones asíncronas
 */
function iterate<TProps>(externalProps: Partial<TProps>, deps: PropDependencies<TProps>, lastState: State<TProps>): IterateResult<TProps> {
    let state = lastState;
    let promises: PromiseLike<PropUpdates<TProps>>[] = [];
    while (true) {
        const result = getNextStateIteration(externalProps, deps, state.propsState);
        state = result.state;

        if (result.promise)
            promises.push(result.promise)
        //Si ya no hubo cambios se termina el ciclo de iteraciones
        if (!result.hadSyncUpdates) {
            break;
        }
    }

    return { state, promises };
}


/**True si todas las propiedades de un state estan en status "done" */
function propsStateAllDone<TProps>(state: PropsState<TProps>) {
    const keys = Object.keys(state).map(key => state[key]);
    const done = all(keys, x => x && x.status == "done" || false);
    return done;
}

/**Dadas las propiedades iniciales, resuelve las dependencias de información dadas por deps y devuelve los props resueltos en la función resolve.
 * Devuelve una función que notifica de un cambio de las propiedades externas
 */
export function getNextState<TProps>(initialProps: Partial<TProps>, deps: PropDependencies<TProps>, resolve: (props: TProps) => void): (nextProps: Partial<TProps>) => void {
    const allPropsFromDeps = Object.keys(deps) as (keyof TProps)[];

    let promises: PromiseLike<PropUpdates<TProps>>[] = [];
    let state: State<TProps> = { lastProps: undefined, propsState: {} };
    let externalProps = initialProps;

    function dispatchPromise(change: PropUpdates<TProps>, original: PromiseLike<PropUpdates<TProps>>) {
        //Eliminamos esta promesa de las promesas pendientes:
        promises = promises.filter(x => x != original);
        //Actualizamos el state con la información de la promesa, y realizamos de nuevo el chequeo:
        state = { ...state, propsState: getNextStateFromChange(state.propsState, change) };
        //Iniciamos el ciclo de chequeo otra vez, esto se seguira repitiendo hasta que ya no existan mas promesas pendientes
        check();
    }

    function dispatchChange(nextProps: TProps) {
        externalProps = nextProps;
        check();
    }

    function check() {
        const result = iterate(externalProps, deps, state);
        state = result.state;
        promises = [...promises, ...result.promises];
        for (const prom of result.promises) {
            prom.then(promResult => dispatchPromise(promResult, prom));
        }

        if (propsStateAllDone(result.state.propsState)) {
            //Extraemos las propiedades: 
            const effectiveProps = getEffectiveProps(externalProps, allPropsFromDeps, state.propsState);
            resolve(effectiveProps as TProps);
        }
    }

    //Iniciamos el ciclo:
    check();

    return dispatchChange;
}