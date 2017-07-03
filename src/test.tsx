import { getNextStateIteration, getNextStateFromChange, getNextState } from "./logic";

import { PropQuery, PromiseResult, PropDependencies, AsyncPropQuery, QueryParams } from "./types";
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
interface Props {
    idCliente: number;
    value: number;
    clientes: number[];
    suma3: number;
    suma4: number;
    suma2: number;
    suma: number;
}

export function doTest() {
    const deps: PropDependencies<Props> = {
        clientes: {
            query: async (props) => {
                await delay(100);
                return [props.idCliente];
            },
            params: ["idCliente"],
            async: true
        },
        value: {
            query: (props) => props.clientes[0] + 1,
            params: ["clientes"]
        },
        suma: {
            query: (props) => props.idCliente + 2,
            params: ["idCliente"]
        },
        suma2: {
            query: async (props) => {
                await delay(200);
                return props.suma + 1;
            },
            params: ["suma"],
            async: true
        },
        suma3: {
            query: (props) => props.suma2 + 1,
            params: ["suma2"]
        },
        suma4: {
            query: (props) => props.suma3 + 1,
            params: ["suma3"]
        }
    };

    const props: Partial<Props> = {
        idCliente: 5,
    };

    function resolve(props: Props) {
        props = props;
    }
    const result = getNextState(props, deps, resolve);

    //result.dispatchChange({ idCliente: 6});
    setTimeout(() => result({ idCliente: 6 }), 1000);
}
