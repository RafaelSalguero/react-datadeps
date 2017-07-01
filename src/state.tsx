type QueryState = "loading" | "error" | "done";
/**Indicate that a prop value is still waiting for completition */
export const propPendingValue = { _: "pending_value", toString: () => "pending_value" };
type PendingValue = typeof propPendingValue;
export interface DonePerPropState<TProp> {
    lastQueryResult: TProp;
    lastParams: any[];
    status: "done";
}

export interface PendingPerPropState {
    status: "pending";
    lastParams: any[] | undefined;
}
export interface ErrorPerPropState {
    status: "error";
    lastParams: any[];
    error: any;
}
export type PerPropState<TProp> = DonePerPropState<TProp> | PendingPerPropState | ErrorPerPropState;
export type PropsState<TProps> = {[K in keyof TProps]?: PerPropState<TProps[K]> };
export interface State<TProps> {
    /**Estados por propiedad */
    propsState: PropsState<TProps>;
    /**Valores anteriores de las propiedades, que se utilizarán para las comparaciones */
    lastProps?: Partial<TProps>;
}