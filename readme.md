# react-datadeps
## Manage data dependencies with stateless components

### 1.- Create a stateless component
```tsx
interface Props {
    id: string;
    myData: string;
    myRefresh: () => void;
}
class MyComponent extends React.Component<Props, {}> {
    render() {
        return <div>
            {this.props.data}
            <button onClick={this.props.myRefresh} >Refresh!</button>
        </div>
    }
}
```

### 2.- `mapPropsToThunks`
```ts
import { mapPropsToThunks } from "react-datadeps";
import { myService } from "./myService";

const MyComponent2 = mapPropsToThunks()((props, refresh) => ({
    //Declarative data dependencies:
    id: {
        query: () => app.router.state["id"]
    },
    myData: {
        query: async () => await myService(props.id), //query can be an async thunk
        async: true, //await for the query result
        params: [props.id] //when props.id change, reevaluate query
    }, 
    myRefresh: {
        query: () => () => refresh("myData") //Inner component can fire a data refresh
    }
}))(MyComponent);
```

### 3.- Consume the component
```jsx
//myData will be evaluated each time "id" changes or
//when the user press the refresh button
<MyComponent2 id="34" />
```