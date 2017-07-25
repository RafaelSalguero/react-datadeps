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
function shouldUpdate(nextParams: any[], lastStateParams: any[] | undefined, force: boolean): "update" | "nothingChanged" | "pendingDeps" {
    const anyPending = any(nextParams, x => x == propPendingValue);
    if (anyPending) return "pendingDeps";

    const change = lastStateParams == undefined || !sequenceEquals(lastStateParams, nextParams);
    return (change || force) ? "update" : "nothingChanged";
}



interface InitialPropStateResult<TProp> {
    value: PerPropState<TProp>;
    /**Promesa si es que el valor es asíncrono */
    promise?: PromiseLike<PromiseResult<TProp>>;
}

/**Obtiene el valor efectivo de una propiedad */
export function getEffectivePropValue<TProps, Key extends keyof TProps>(prop: Key, externalProps: Partial<TProps>, state: PerPropState<TProps[Key]>) {
    if (externalProps[prop]) {
        return externalProps[prop];
    } else {
        return state.status == "done" ? state.lastQueryResult : propPendingValue;
    }
}

/**Tipo de la función que se encarga de mezclar los props internos y los externos */
export type Mixer<TProps> = (stateProps: Partial<TProps>, externalProps: Partial<TProps>) => Partial<TProps>;

/**Mezcla las propiedades externas y las del estado actual para obtener los props efectivos que seran pasados al componente hijo.
 * @param externalProps Propiedades externals
 * @param allPropsFromDeps Nombre de las propiedades que participan en la declaración de las dependencias de información
 * @param state Estado actual
 */
export function getEffectiveProps<TProps>(externalProps: Partial<TProps>, allPropsFromDeps: (keyof TProps)[], state: PropsState<TProps>, mixer: Mixer<TProps>): Partial<TProps> {
    const stateProps = toMap(allPropsFromDeps
        .map(x => ({ key: x, value: state[x] }))
        .map(x => ({ ...x, value: x.value && x.value.status == "done" ? x.value.lastQueryResult : propPendingValue })),
        x => x.key,
        x => x.value);

    const result = mixer(stateProps as any, externalProps);
    return result;
}

/**Funcion por default que se encarga de mezclar los props internos del state provenientes de la resolución de dependencias y los props externos.
 * Este mixer mezcla todas las propiedades del state, seguidas de las externas, dandole prioridad a las externas */
export function defaultMix<TProps>(stateProps: Partial<TProps>, externalProps: Partial<TProps>): Partial<TProps> {
    return { ... (stateProps as any), ... (externalProps as any) };
}


/**Obtiene el estado inicial para una de las propiedades. Devuelve una promesa como parte del resultado en caso de que la propiedad sea
 * asíncrona */
function getInitialStateSingleProp<TProps, TProp>(params: QueryParams<TProps>, dep: PropQuery<TProps, TProp>): InitialPropStateResult<TProp> {
    const lastParams = (dep.params || []).map(key => params.props[key]);
    if (IsAsyncPropQuery<TProps, TProp>(dep)) {
        const promise = dep.query(params.props as TProps, params.refresh);
        const props = params.props;
        const depParams = dep.params || [];
        const nextParams = depParams.map(key => params.props[key]);

        const promiseResult: PromiseLike<PromiseResult<TProp>> = promise
            .then(success => ({ status: "done", value: success } as PromiseResult<TProp>), error => ({ status: "error", error: error } as PromiseResult<TProp>));

        return {
            value: {
                status: "pending",
                lastParams: lastParams,
            },
            promise: promiseResult
        };
    } else {
        const result = dep.query(params.props as TProps, params.refresh);
        return {
            value: {
                status: "done",
                lastQueryResult: result,
                lastParams: lastParams
            }
        };
    }
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

export function getNextStateFromChangeSingleProp<TProps, TProp>(lastState: PerPropState<TProp> | undefined, change: PromiseResult<TProp>) {
    const lastParams = lastState && lastState.lastParams || [];
    const nextState = promiseResultToState(change, lastParams);
    return nextState;
}

/**Obtiene el siguiente state dado un cambio de propiedad */
export function getNextStateFromChange<TProps>(lastStateFull: PropsState<TProps>, prop: keyof TProps, change: PromiseResult<TProps[keyof TProps]>): PropsState<TProps> {
    const nextStateSingleProp = getNextStateFromChangeSingleProp(lastStateFull[prop], change);
    const nextState = Object.assign({}, lastStateFull, { [prop]: nextStateSingleProp });
    return nextState;
}

/**Extrae los valores de las dependencias de información de una propiedad */
export function extractParamValues<TProps>(effectiveProps: Partial<TProps>, params: (keyof TProps)[] | undefined): any[] {
    return (params || []).map(key => effectiveProps[key]);
}

/**Una promesa creada debido al cambio de una propiedad asíncrona. Almacena tanto la promesa como los parametros originales,
 * esto para verificar que los parametros originales sean los mismos al final de la resolución de la promesa
 */
export interface ChangePromise<TProps> {
    /**Valores de los parametros originales que se utilizaron para la ejecución del query */
    params: any[];
    /**Nombre de la propiedad */
    prop: keyof TProps;
    /**Promesa con la resolución del valor de la propiedad */
    promise: PromiseLike<PromiseResult<TProps[keyof TProps]>>
}

export interface InitialStateResult<TProps> {
    /**El nuevo state */
    state: State<TProps>;

    /**Todas las promesas generadas que se deben de atender para obtener el siguiente state */
    promises: ChangePromise<TProps>[];

    /**True si el estado fue actualizado de manera sincrona, lo que indica que inmediatamente se debe de intentar actualizar de nuevo*/
    hadSyncUpdates: boolean;
}

/**Obtiene el estado inicial de todas las propiedades. Devuelve una promisa que se resuelve cuando todas las propiedades asíncronas han sido resueltas, y que
 * incluye los resultados de la resolución de esas propiedades
 * @param forceUpdate Propiedad que queremos actualizar incluso si ninguna de sus dependencias ha cambiado
 */
export function getNextStateIteration<TProps>(
    externalProps: Partial<TProps>,
    deps: PropDependencies<TProps>,
    lastState: PropsState<TProps>,
    forceUpdate: (keyof TProps) | undefined,
    refresh: (prop: keyof TProps) => PromiseLike<void>,
    mixer: Mixer<TProps>
): InitialStateResult<TProps> {

    const allPropsFromDeps = Object.keys(deps) as (keyof TProps)[];
    const params: QueryParams<TProps> = {
        props: getEffectiveProps(externalProps, allPropsFromDeps, lastState, mixer),
        refresh: refresh
    };
    type PerPropResult = {[K in keyof TProps]?: InitialPropStateResult<TProps[K]> };
    const perProp: PerPropResult = {};

    //Formamos el objeto que contiene todas las propiedades por promesa:
    const promises: ChangePromise<TProps>[] = [];
    const resultValue: State<TProps> = { lastProps: params.props, propsState: {} };

    let hadSyncUpdates: boolean = false;
    for (const prop of allPropsFromDeps) {
        const dep = deps[prop];
        if (dep) {
            const nextParams = extractParamValues(params.props, dep.params);
            const lastStateProp = lastState[prop];
            const lastParams = lastStateProp && lastStateProp.lastParams;
            const update = shouldUpdate(nextParams, lastParams, prop == forceUpdate);

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
                const prom = result.promise;
                const item: ChangePromise<TProps> = {
                    params: extractParamValues(params.props, dep.params),
                    prop: prop,
                    promise: prom
                };

                promises.push(item);
            }
        }
    }

    const result: InitialStateResult<TProps> = {
        promises: promises,
        state: resultValue,
        hadSyncUpdates: hadSyncUpdates
    };

    return result;
}


export interface IterateResult<TProps> {
    state: State<TProps>;
    promises: ChangePromise<TProps>[];
}

/**Itera obteniendo el siguiente state con getNextStateIteration hasta que ya no hay actualizaciones síncronas, y devuelve un arreglo con las promesas
 * de las actualizaciones asíncronas
 * @param forceUpdate Propiedad que queremos actualizar inclusi si ninguna de sus dependencias ha cambiado
 */
export function iterate<TProps>(
    externalProps: Partial<TProps>,
    deps: PropDependencies<TProps>,
    lastState: State<TProps>,
    forceUpdate: (keyof TProps) | undefined,
    refresh: (prop: keyof TProps) => PromiseLike<void>,
    mixer: Mixer<TProps>
): IterateResult<TProps> {

    let state = lastState;
    let promises: ChangePromise<TProps>[] = [];
    while (true) {
        const result = getNextStateIteration(externalProps, deps, state.propsState, forceUpdate, refresh, mixer);
        state = result.state;
        promises.push(...result.promises)

        //Si ya no hubo cambios se termina el ciclo de iteraciones
        if (!result.hadSyncUpdates) {
            break;
        }
    }

    return { state, promises };
}


/**Devuelve el status reducido de todos los props. Devuelve error si por lo menos una es error, si no, pending si por lo menos una es pending, si no, devuelve done */
export function propsState<TProps>(state: PropsState<TProps>): "done" | "pending" | "error" {
    const status = Object.keys(state).map(key => state[key]).filter(x => x).map(x => x!.status);
    const result = status.reduce((prev, curr) => {
        if (prev == "error" || curr == "error") return "error";
        if (prev == "pending" || curr == "pending") return "pending";
        return "done";
    }, "done");

    return result;
}
