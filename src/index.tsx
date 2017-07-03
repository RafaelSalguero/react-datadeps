import React = require("react");
import { doTest } from "./test";
export { PropDependencies, AsyncPropQuery, SyncPropQuery } from "./types";
import { PropDependencies } from "./types";
import { getNextState } from "./nextState";
//doTest();

export function mapThunksToProps(error: JSX.Element, loading: JSX.Element) {
    return function <TProps>(deps: PropDependencies<TProps>) {
        return function (Component: React.ComponentClass<TProps>): React.ComponentClass<Partial<TProps>> {
             const r = class MapThunksComponent extends React.PureComponent<Partial<TProps>, { props: any }> {
                constructor(props: Partial<TProps>) {
                    super(props);
                    this.handleNextProps = getNextState<any>(props, deps, this.handleResolve);
                    this.state = { props: undefined };
                }

                private handleNextProps: (props: any) => void;

                private handleResolve = (props: any) => {
                    this.setState({ props: props });
                };

                componentWillReceiveProps(nextProps: Partial<TProps>) {
                    this.handleNextProps(nextProps);
                }

                render() {
                    if (this.state.props) {
                        return <Component {... this.state.props} />;
                    } else {
                        return loading;
                    }
                }
            };

            return r;
        }
    }
}