import React = require("react");
import { doTest } from  "./test";

doTest();
interface PropsQuery {
    [key: string]: PropQuery<any, any>
}

type TypedPropsQuery<TProps> = {[K in keyof TProps]?: PropQuery<TProps, TProps[K]> };
interface QueryVersion {
    [prop: string]: number
};
/**Define a data dependency for a prop */
export interface PropQuery<TProps, TProp> {
    /**True to await the result of the query method and pass the resolved value to the inner component, false to pass the value as is. Default is false */
    async?: boolean;
    /**Get the query parameters, if this methods returns the same according to a shallowCompare, the query is not executed*/
    params?: any[];
    /**Get a promise with the value to pass to the prop, the first argument is the result*/
    query: () => PromiseLike<TProp> | TProp;
}

interface MyProps {
    id: number;
    name: string;
    data: Date[];
    refreshData: () => void;
}

interface ReactQueryProps {
    /**The child component to render */
    component: typeof React.PureComponent;
    /**The element to show when the component data is loading */
    loading?: JSX.Element;
    error?: JSX.Element;
    /**Props to pass to the child component */
    props: any;
    /**Data dependencies definition */
    dataDependencies: (props: any, refresh: (propName: string) => void) => PropsQuery;
}

/**Indicate that a prop value is still waiting for completition */
const propPendingValue = { _: "pending_value", toString: () => "pending_value" };
interface PerPropState {
    lastParams?: any[];
    lastQueryResult?: any;
    status: "loading" | "error" | "done";
}
interface ReactQueryState {
    [prop: string]: PerPropState;
}

/**Shallow compare an array */
function sequenceEquals<T>(a: T[], b: T[]) {
    if (a.length != b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] != b[i]) return false;
    }
    return true;
}
/**Return a new state with the given modification to a prop */
const refreshStatePropState = (state: ReactQueryState, propName: string, change: Partial<PerPropState>) => ({ ...state, [propName]: { ...state[propName], ...change } });

/**Get the props that will be pased to the inner component */
function getEffectiveChildProps(state: ReactQueryState, externalProps: any) {
    /**Get an object with prop values mapped from the solved or unsolved data dependencies */
    const childProps = Object.keys(state).map(key => ({ result: state[key].lastQueryResult, key })).reduce((a, b) => ({ ...a, [b.key]: b.result }), {} as any);
    return { ...childProps, ...externalProps };
}

/**Check if the given property need and update and refresh it */
function tryRefreshSingleProp(query: () => void, nextParams: any[], lastStateParams: any[] | undefined, refreshResult: (result: any) => void) {
    //Do not update if this prop value depends on another prop defined as a data dependency
    const anyPending = nextParams.filter(x => x == propPendingValue).length > 0;
    const shouldUpdate = !anyPending && (lastStateParams == undefined || !sequenceEquals(lastStateParams, nextParams));

    if (shouldUpdate) {
        const result = query();
        refreshResult(result);
    }
}

/**
 * Refresh all props
 * @param nextProps The next or current component props
 * @param lastStateFull The last state to compare with
 * @param refresh A function that triggers the refresh of a query
 * @param refreshResult A function that is called with the query results of the queries that needed to be reevaluated
 */
function refreshProps(nextProps: ReactQueryProps, lastStateFull: ReactQueryState, refresh: (prop: string) => void, refreshResult: (prop: string, result: any, params: any[], async: boolean) => void) {
    const childProps = getEffectiveChildProps(lastStateFull, nextProps.props);
    const depTree = nextProps.dataDependencies(childProps, refresh);
    //For all information dependencies:
    for (const propName in depTree) {
        const dep = depTree[propName] as PropQuery<any, any>;
        const lastStateParams = lastStateFull[propName] && lastStateFull[propName].lastParams;
        const nextParams = (dep.params || []).map((key)=> childProps[key]);

        tryRefreshSingleProp(dep.query, nextParams, lastStateParams, (result) => refreshResult(propName, result, nextParams, !!dep.async));
    }
}

/**
 * Call the setState with the query result, awaits the result if async== true.
 * The promise is resolved when all the states sets are finished
 * @param propName Prop name to refresh
 * @param queryResult Query result for this prop
 * @param queryParams Query params that resulted on the given query evaluation
 * @param async True to await the query result
 * @param setState Function to set the component state
 */
async function refreshResult(propName: string, queryResult: any, queryParams: any[], async: boolean, setState: (change: (prevState: ReactQueryState) => Partial<ReactQueryState>) => PromiseLike<void>) {
    if (async) {
        //Set the query params:
        await setState((prevState) => refreshStatePropState(prevState, propName, { lastParams: queryParams }));
        //Await the promise, then call setState:
        await (async () => {
            const result = await queryResult;
            await setState((prevState) => refreshStatePropState(prevState, propName, { status: "done", lastQueryResult: result }));
        })();
    } else {
        await setState((prevState) => refreshStatePropState(prevState, propName, { status: "done", lastQueryResult: queryResult, lastParams: queryParams }));
    }
}

/**Get the initial state for a ReactQueryComponent */
function getInitialState(depTree: PropsQuery): ReactQueryState {
    const keys = Object.keys(depTree);
    const initialState: PerPropState = { status: "loading", lastQueryResult: propPendingValue };
    const ret = keys.reduce((x, key) => ({ ...x, [key]: initialState }), {});
    return ret;
}

class ReactDataDepsComponent extends React.PureComponent<ReactQueryProps, ReactQueryState>{
    constructor(props: ReactQueryProps) {
        super(props);
        //Init all props state with status: "loading"
        this.state = getInitialState(props.dataDependencies(props.props, () => null));
    }

    /**Prevent previoues query refreshes to override newer query refreshes */
    private propVersion: QueryVersion = {};

    private refresh = (propName: string) => {
        const dep = this.props.dataDependencies(this.props.props, this.refresh)[propName] as PropQuery<any, any>;
        const result = dep.query();
        this.refreshResult(propName, result, dep.params || [], !!dep.async);
    }

    private refreshProps = (nextProps: any) => refreshProps(nextProps, this.state, this.refresh, this.refreshResult);

    /**Refresh the result */
    private refreshResult = async (propName: string, queryResult: any, queryParams: any[], async: boolean) => {
        //Increment the prop version:
        const currentVersion = (this.propVersion[propName] || 0) + 1;
        this.propVersion[propName] = currentVersion;

        const setState = async (change: (prev: ReactQueryState) => Partial<ReactQueryState>) => {
            //Only setState if the propVersion is the same as the currentVersion at the moment of the setState call
            if (this.propVersion[propName] == currentVersion)
                await new Promise((resolve) => this.setState(change, resolve));
        };
        await refreshResult(propName, queryResult, queryParams, async, setState);
        //refresh props after setting states:
        this.refreshProps(this.props);
    }

    componentDidMount() {
        //Initial refresh
        this.refreshProps(this.props);
    }

    componentWillReceiveProps(nextProps: ReactQueryProps) {
        this.refreshProps(nextProps);
    }

    render() {
        const state = this.state;
        const keys = Object.keys(state)
        const allStatus = keys.map(key => state[key].status);
        const allDone = allStatus.map(x => x == "done").reduce((a, b) => a && b, true);
        const someError = allStatus.map(x => x == "error").reduce((a, b) => a || b, false);

        if (someError) {
            return this.props.error || null;
        } else if (allDone) {
            //Mix props from query with extern props:
            const childProps = getEffectiveChildProps(this.state, this.props.props);
            return React.createElement(this.props.component, childProps);
        } else {
            return this.props.loading || null;
        }
    }
}


/**Create a curry function that */
export function mapPropsToThunks(loading?: JSX.Element, error?: JSX.Element) {
    return function <TProps>(dependencies: (props: TProps, refresh: (prop: keyof TProps) => void) => TypedPropsQuery<TProps>) {
        const deps: (props: any, refresh: (prop: string) => void) => PropsQuery = (props, refresh) => (dependencies(props, refresh) as any as PropsQuery);
        return function (component: React.ComponentClass<TProps>) {
            type ResultPropsType = Partial<TProps>;
            const ret: React.ComponentClass<ResultPropsType> = class ReactDataDepWrapper extends React.PureComponent<ResultPropsType, {}> {
                render() {
                    return (
                        <ReactDataDepsComponent
                            component={component}
                            dataDependencies={deps}
                            loading={loading}
                            error={error}
                            props={this.props}
                        />);
                }
            };

            return ret;
        }
    }


}