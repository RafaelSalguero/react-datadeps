# react-datadeps
## Manage data dependencies with stateless components

### 1.- Create a stateless component
```tsx
interface Props {
    id: string;
    myData: string;
    moreData: string;
    myRefresh: () => void;
}
class MyComponent extends React.Component<Props, {}> {
    render() {
        return <div>
            {this.props.myData}
            {this.props.moreData}
            <button onClick={this.props.myRefresh} >Refresh!</button>
        </div>
    }
}
```

### 2.- `mapPropsToThunks`
```ts
import { mapPropsToThunks, PropDependencies } from "react-datadeps";
import { myService, otherService } from "./myService";

const deps: PropDependencies<Props> = {
    myData: {
        query: async (props) => await myService(props.id), //query can be an async function
        async: true, //true to await the query result
        params: ["id"] //when props.id changes, refresh this query
    },
    moreData: {
        query: async (props) => await otherService(props.myData), //neasted data dependency
        async: true,
        params: ["myData"]
    },
    my
};

const MyComponent2 = mapPropsToThunks()((props, refresh) => ({
    //Declarative data dependencies:
    myData: {
        query: async () => await myService(props.id), //query can be an async thunk
        async: true, //await for the query result
        params: [props.id] //when props.id changes, refresh this query
    }, 
    moreData: {
        query: async () => await otherService(props.myData), //neasted data dependency
        async: true,
        params: [props.myData]
    },
    myRefresh: {
        query: () => () => refresh("myData") //Inner component can fire a data refresh
    }
}))(MyComponent);
```

### 3.- Consume the component
```jsx
//If id changes, myData and moreData will be refreshed
<MyComponent2 id="42" />
```