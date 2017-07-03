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
    myRefresh: {
        query: (props, refresh) => () => refresh() //Inner component can fire a data refresh
    }
};

```

### 3.- Consume the component
```jsx
//If id changes, myData and moreData will be refreshed
<MyComponent2 id="42" />
```