export interface AsyncPropQuery<TProps, TProp> {
    /**True to await the result of the query method and pass the resolved value to the inner component, false to pass the value as is. Default is false */
    async: true;
    /**Get the names of the props that trigger a refresh on the query*/
    params?: (keyof TProps)[];
    /**Get a promise with the value to pass to the prop */
    query: (props: TProps, refresh: (propName: keyof TProps) => void) => PromiseLike<TProp>;
};

export interface SyncPropQuery<TProps, TProp> {
    /**Get the names of the props that trigger a refresh on the query*/
    params?: (keyof TProps)[];
    /**A thunk with the value to pass to the prop */
    query: (props: TProps, refresh: (propName: keyof TProps) => void) => TProp
};

export type PropQuery<TProps, TProp> = AsyncPropQuery<TProps, TProp> | SyncPropQuery<TProps, TProp>;
export type PropDependencies<TProps> = {[K in keyof TProps]?: PropQuery<TProps, TProps[K]> };

export type PromiseResult<T> = { status: "done", value: T } | { status: "error", error: any };
export interface QueryParams<TProps> {
    /**Current props */
    props: Partial<TProps>;
    /**Refresh the given prop query. The refresh happens only if all prop dependencies are fully solved */
    refresh: (prop: keyof TProps) => PromiseLike<void>;
}
//**********************************
//syntax test:
//**********************************
interface Props {
    idUsuario: number;
    idCliente: number;
    value: number;
    clientes: number[];
    onChange: (value: number) => void;
    onGuardar: () => void;
}

const y: PropDependencies<Props> = {
    clientes: {
        query: () => [29],
        params: ["idCliente"]
    }
};