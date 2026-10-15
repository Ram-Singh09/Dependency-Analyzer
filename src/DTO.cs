
public sealed record Analyzer_Args
(
    Dictionary<int, DA_Node> Nodes,
    Dictionary<int, int> States,
    DA_State[] State_helpers, 
    int Target_node_id
);

public sealed record Analyzer_Result(List<int> Nodes_open);

public enum Result_State
{
    Success, Data_Null, Target_Node_Invalid, Analysis_Failed, Unknown
}
