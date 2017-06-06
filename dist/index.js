"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var React = require("react");
;
/**Shallow compare an array */
function sequenceEquals(a, b) {
    if (a.length != b.length)
        return false;
    for (var i = 0; i < a.length; i++) {
        if (a[i] != b[i])
            return false;
    }
    return true;
}
/**Return a new state with the given modification to a prop */
var refreshStatePropState = function (state, propName, change) {
    return (__assign({}, state, (_a = {}, _a[propName] = __assign({}, state[propName], change), _a)));
    var _a;
};
/**
 * Refresh all props
 * @param nextProps The next or current component props
 * @param lastStateFull The last state to compare with
 * @param refresh A function that triggers the refresh of a query
 * @param refreshResult A function that is called with the query results of the queries that needed to be reevaluated
 * @param syncOnly True to ignore async dependencies
 */
function refreshProps(nextProps, lastStateFull, refresh, refreshResult, syncOnly) {
    var depTree = nextProps.dataDependencies(nextProps.props);
    //Recorremos todas las dependencias de información:
    for (var propName in depTree) {
        var dep = depTree[propName];
        if (!dep.async || !syncOnly) {
            var lastState = lastStateFull[propName] || { status: "loading" };
            var nextParams = dep.params || [];
            var shouldUpdate = (lastState.lastParams == undefined || !sequenceEquals(lastState.lastParams, nextParams));
            if (shouldUpdate) {
                var result = dep.query(refresh);
                refreshResult(propName, result, nextParams, !!dep.async);
            }
        }
    }
}
/**
 * Call the setState with the query result, awaits the result if async== true
 * @param propName Prop name to refresh
 * @param queryResult Query result for this prop
 * @param queryParams Query params that resulted on the given query evaluation
 * @param async True to await the query result
 * @param setState Function to set the component state
 */
function refreshResult(propName, queryResult, queryParams, async, setState) {
    var _this = this;
    if (async) {
        //Set the query params:
        setState(function (prevState) { return refreshStatePropState(prevState, propName, { lastParams: queryParams }); });
        //Await the promise, then call setState:
        (function () { return __awaiter(_this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, queryResult];
                    case 1:
                        result = _a.sent();
                        setState(function (prevState) { return refreshStatePropState(prevState, propName, { status: "done", lastQueryResult: queryResult }); });
                        return [2 /*return*/];
                }
            });
        }); })();
    }
    else {
        setState(function (prevState) { return refreshStatePropState(prevState, propName, { status: "done", lastQueryResult: queryResult, lastParams: queryParams }); });
    }
}
/**Get the initial state for a ReactQueryComponent */
function getInitialState(depTree) {
    var keys = Object.keys(depTree);
    var initialState = { status: "loading" };
    var ret = keys.reduce(function (x, key) {
        return (__assign({}, x, (_a = {}, _a[key] = initialState, _a)));
        var _a;
    }, {});
    return ret;
}
var ReactDataDepsComponent = (function (_super) {
    __extends(ReactDataDepsComponent, _super);
    function ReactDataDepsComponent(props) {
        var _this = _super.call(this, props) || this;
        /**Prevent previoues query refreshes to override newer query refreshes */
        _this.propVersion = {};
        _this.refresh = function (propName) {
            var dep = _this.props.dataDependencies(_this.props.props)[propName];
            var result = dep.query(_this.refresh);
            _this.refreshResult(propName, result, dep.params || [], !!dep.async);
        };
        /**Refresh the result */
        _this.refreshResult = function (propName, queryResult, queryParams, async) {
            //Increment the prop version:
            var currentVersion = (_this.propVersion[propName] || 0) + 1;
            _this.propVersion[propName] = currentVersion;
            var setState = function (change) {
                //Only setState if the propVersion is the same as the currentVersion at the moment of the setState call
                if (_this.propVersion[propName] == currentVersion)
                    _this.setState(change);
            };
            refreshResult(propName, queryResult, queryParams, async, setState);
        };
        //Init all props state with status: "loading"
        _this.state = getInitialState(props.dataDependencies(props.props));
        return _this;
    }
    ReactDataDepsComponent.prototype.componentDidMount = function () {
        //Initial refresh
        refreshProps(this.props, this.state, this.refresh, this.refreshResult, false);
    };
    ReactDataDepsComponent.prototype.componentWillReceiveProps = function (nextProps) {
        refreshProps(nextProps, this.state, this.refresh, this.refreshResult, false);
    };
    ReactDataDepsComponent.prototype.render = function () {
        var state = this.state;
        var keys = Object.keys(state);
        var allStatus = keys.map(function (key) { return state[key].status; });
        var allDone = allStatus.map(function (x) { return x == "done"; }).reduce(function (a, b) { return a && b; }, true);
        var someError = allStatus.map(function (x) { return x == "error"; }).reduce(function (a, b) { return a || b; }, false);
        if (someError) {
            return this.props.error || null;
        }
        else if (allDone) {
            //Form the props object:
            var childPropsFromState = keys.map(function (key) { return ({ result: state[key].lastQueryResult, key: key }); }).reduce(function (a, b) {
                return (__assign({}, a, (_a = {}, _a[b.key] = b.result, _a)));
                var _a;
            }, {});
            //Mix props from query with extern props:
            var childProps = __assign({}, childPropsFromState, this.props.props);
            return React.createElement(this.props.component, childProps);
        }
        else {
            return this.props.loading || null;
        }
    };
    return ReactDataDepsComponent;
}(React.PureComponent));
/**Create a curry function that */
function mapPropsToThunks(loading, error) {
    return function (dependencies) {
        var deps = dependencies;
        return function (component) {
            var ret = (function (_super) {
                __extends(ReactDataDepWrapper, _super);
                function ReactDataDepWrapper() {
                    return _super !== null && _super.apply(this, arguments) || this;
                }
                ReactDataDepWrapper.prototype.render = function () {
                    return (React.createElement(ReactDataDepsComponent, { component: component, dataDependencies: deps, loading: loading, error: error, props: this.props }));
                };
                return ReactDataDepWrapper;
            }(React.PureComponent));
            return ret;
        };
    };
}
exports.mapPropsToThunks = mapPropsToThunks;
