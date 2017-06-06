/// <reference types="react" />
import React = require("react");
/**Define a data dependency for a prop */
export interface PropQuery<TProps, TProp> {
    /**True to await the result of the query method and pass the resolved value to the inner component, false to pass the value as is. Default is false */
    async?: boolean;
    /**Get the query parameters, if this methods returns the same according to a shallowCompare, the query is not executed*/
    params?: any[];
    /**Get a promise with the value to pass to the prop, the first argument is the result*/
    query: (refresh: (prop: keyof TProps) => void) => PromiseLike<TProp> | TProp;
}
/**Create a curry function that */
export declare function mapPropsToThunks(loading?: JSX.Element, error?: JSX.Element): <TProps>(dependencies: (props: TProps) => {
    [K in keyof TProps]?: PropQuery<TProps, TProps[K]> | undefined;
}) => (component: React.ComponentClass<TProps>) => React.ComponentClass<Partial<TProps>>;
