import React = require("react");

interface PropsQuery {
    [key: string]: PropQuery<any, any>
}

export type TypedPropsQuery<TProps> = {[K in keyof TProps]?: PropQuery<TProps, TProps[K]> };

interface PropQuery<TProps, TProp> {
    /**True to await the result of the query method and pass the resolved value to the inner component, false to pass the value as is. Default is false */
    async?: boolean;
    /**Get the query parameters, if this methods returns the same according to a shallowCompare, the query is not executed*/
    params?: any[];
    /**Get a promise with the value to pass to the prop, the first argument is the result*/
    query: (refresh: (prop: keyof TProps) => void) => PromiseLike<TProp> | TProp;
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
    loading: JSX.Element;
    error: JSX.Element;
    /**Props to pass to the child component */
    props: any;
    /**Data dependencies definition */
    dataDependencies: (props: any) => PropsQuery;
}

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

/**
 * Refresh a query component state
 * @param state The last state
 * @param propName The property name to refresh
 * @param queryResult The value to set as the query result
 */
function refreshState(state: { [prop: string]: PerPropState }, propName: string, queryResult: any) {
    return { ...state, [propName]: ({ ...state[propName], lastQueryResult: queryResult, status:  "done" } as PerPropState) };
}

/**
 * 
 * @param nextProps The next or current component props
 * @param lastStateFull The last state to compare with
 * @param refresh A function that triggers the refresh of a query
 * @param refreshResult A function that is called with the query results of the queries that needed to be reevaluated
 * @param syncOnly True to ignore async dependencies
 */
function refreshProps(nextProps: ReactQueryProps, lastStateFull: ReactQueryState, refresh: (prop: string) => void, refreshResult: (prop: string, result: any, async: boolean) => void, syncOnly: boolean) {
    const depTree = nextProps.dataDependencies(nextProps.props);
    //Recorremos todas las dependencias de información:
    for (const propName in depTree) {
        const dep = depTree[propName] as PropQuery<any, any>;

        if (!dep.async || !syncOnly) {
            const lastState = lastStateFull[propName] || ({ status: "loading" } as PerPropState);
            const nextParams = dep.params || [];
            const shouldUpdate = (lastState.lastParams == undefined || !sequenceEquals(lastState.lastParams, nextParams));
            if (shouldUpdate) {
                const result = dep.query(refresh);
                refreshResult(propName, result, !!dep.async);
            }
        }
    }
}

/**Call the setState with the query result, awaits the result if async== true */
function refreshResult(propName: string, queryResult: any, async: boolean, setState: (change: (prevState: ReactQueryState) => Partial<ReactQueryState>) => void) {
    if (async) {
        //Await the promise, then call setState:
        (async () => {
            const result = await queryResult;
            setState((prevState) => refreshState(prevState, propName, result));
        })();
    } else {
        setState((prevState) => refreshState(prevState, propName, queryResult));
    }
}

/**Get the initial state for a ReactQueryComponent */
function getInitialState(depTree: PropsQuery): ReactQueryState {
    const keys = Object.keys(depTree);
    const initialState: PerPropState = { status: "loading" };
    const ret = keys.reduce((x, key) => ({ ...x, [key]: initialState }), {});
    return ret;
}

class ReactDataDepsComponent extends React.PureComponent<ReactQueryProps, ReactQueryState>{
    constructor(props: ReactQueryProps) {
        super(props);
        //Init all props state with status: "loading"
        this.state = getInitialState(props.dataDependencies(props.props));
    }

    private refresh = (propName: string) => {
        const dep = this.props.dataDependencies(this.props.props)[propName] as PropQuery<any, any>;
        const result = dep.query(this.refresh);
        this.refreshResult(propName, result, !!dep.async);
    }

    /**Refresh the result */
    private refreshResult = (propName: string, queryResult: any, async: boolean) => {
        refreshResult(propName, queryResult, async, (change: (prev: ReactQueryState) => Partial<ReactQueryState>) => this.setState(change));
    }

    componentDidMount() {
        refreshProps(this.props, this.state, this.refresh, this.refreshResult, false);
    }

    componentWillReceiveProps(nextProps: ReactQueryProps) {
        refreshProps(nextProps, this.state, this.refresh, this.refreshResult, false);
    }

    render() {
        const state = this.state;
        const keys = Object.keys(state)
        const allStatus = keys.map(key => state[key].status);
        const allDone = allStatus.map(x => x == "done").reduce((a, b) => a && b, true);
        const someError = allStatus.map(x => x == "error").reduce((a, b) => a || b, false);

        if (someError) {
            return this.props.error;
        } else if (allDone) {
            //Form the props object:
            const childPropsFromState = keys.map(key => ({ result: state[key].lastQueryResult, key })).reduce((a, b) => ({ ...a, [b.key]: b.result }), {} as any);
            //Mix props from query with extern props:
            const childProps = { ...childPropsFromState, ... this.props.props };
            return React.createElement(this.props.component, childProps);
        } else {
            return this.props.loading;
        }
    }
}

/**Create a curry function that */
export function propsAsData(loading: JSX.Element, error: JSX.Element) {
    return function <TProps>(dependencies: (props: TProps) => TypedPropsQuery<TProps>) {
        const deps: (props: any) => PropsQuery = dependencies as any;
        return function (component: React.ComponentClass<TProps>) {
            type ResultPropsType = Partial<TProps>;
            return class ReactDataDepWrapper extends React.PureComponent<ResultPropsType, {}> {
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
        }
    }


}