import React = require("react");
export { PropDependencies, AsyncPropQuery, SyncPropQuery } from "./types";
import { PropDependencies } from "./types";
import { getNextState } from "./nextState";
//doTest();

export function mapThunksToProps(loading: JSX.Element, error: JSX.Element) {
    return function <TProps>(deps: PropDependencies<TProps>) {
        return function (Component: React.ComponentClass<TProps>): React.ComponentClass<Partial<TProps>> {
            const ret: React.ComponentClass<Partial<TProps>> = class MapThunksComponent extends React.PureComponent<Partial<TProps>, { props: any, status: "done" | "pending" | "error" }> {
                constructor(props: Partial<TProps>) {
                    super(props);
                    this.state = { props: undefined, status: "pending" };
                }

                componentWillMount() {
                    this.handleNextProps = getNextState<any>(this.props, deps, this.handleResolve);
                }

                private handleNextProps: (props: any) => void;

                private handleResolve = (props: any, status: "done" | "pending" | "error") => {
                    this.setState(prev => ({ props: props || prev.props, status }));
                };

                componentWillReceiveProps(nextProps: Partial<TProps>) {
                    this.handleNextProps(nextProps);
                }

                render() {
                    if (this.state.status == "done" || (this.state.props && this.state.status == "pending")) {
                        return <Component {... this.state.props} />;
                    } else if (this.state.status == "pending")
                        return loading;
                    else
                        return error;
                }
            };

            const innerName = Component.displayName || Component.name || "Component";
            ret.displayName = `MapThunksToProps(${innerName})`;
            return ret;
        }
    }
}