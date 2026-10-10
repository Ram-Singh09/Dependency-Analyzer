
struct DA_Node
{
    public int Need_offset, Need_Len, Setter_offset, Setter_Len;
    public bool Visited;

    public DA_Node()
    {
        Visited = false;
        Need_offset = Dependency_Analyzer.Null;
        Setter_offset = Dependency_Analyzer.Null;
    }
}

struct DA_State
{
    public int Id, Val;
    public Dependency_Analyzer.Op_Type Op_type;

    public DA_State(int Id, int Val, Dependency_Analyzer.Op_Type Op_type)
    {
        this.Id = Id;
        this.Val = Val;
        this.Op_type = Op_type;
    }
}

sealed class Dependency_Analyzer
{
    // Vars ------------------------------

    private readonly Dictionary<int, DA_Node> Nodes;
    private readonly Dictionary<int, int> States;
    private DA_State[] State_helpers;
    private int Target_node_id;

    private readonly string[] Syntax;
    
    public const int Null = -1;

    // Funcs -----------------------------

    public Dependency_Analyzer()
    {
        Nodes = new();
        States = new();
        Target_node_id = Null;
    }

    public bool Analyze()
    {
        // some checks 
        if (Nodes.Count == 0 || States.Count == 0)
        {
            Console.WriteLine("Nodes count = {0}, States count = {1}, Either one or both are empty", Nodes.Count, States.Count);
            return false;
        }
        if (State_helpers is null || State_helpers.Length == 0)
        {
            Console.WriteLine("No node marked any need or setters");
            return false;
        }
        if (!Nodes.ContainsKey(Target_node_id))
        {
            Console.WriteLine("Target node id is not in nodes list");
            return false;
        }

        bool Nodes_available = true, Unlocked = false;
        var Nodes_visited = new List<int>(Nodes.Count); // for newly visited ones to be updated

        try
        {
            // until no new nodes can b found
            while (Nodes_available)
            {
                Nodes_available = false;
                Nodes_visited.Clear();

                foreach (var i in Nodes)
                {
                    var Temp_val = i.Value;
                    if (Temp_val.Visited) continue;

                    // section it marks in array does current state val match needed vals
                    Unlocked = false;

                    if (Temp_val.Need_offset != Null)
                        for (int j = Temp_val.Need_offset; j < Temp_val.Need_offset + Temp_val.Need_Len; j++)
                        {
                            // if any need not complete it will break thats why next one is in condition
                            if (States[State_helpers[j].Id] != State_helpers[j].Val)
                                break;

                            // means all conditions met
                            if (j == Temp_val.Need_offset + Temp_val.Need_Len - 1)
                                Unlocked = true;
                        }

                    else Unlocked = true;

                    // if visiting nodes updates state, and must be done on last itter means all needs fullfilled
                    if (Temp_val.Setter_offset != Null && Unlocked)
                    {
                        // changing state is only way to make new ndoes avialable
                        Nodes_available = true;

                        // set vals in array to be in the state
                        for (int k = Temp_val.Setter_offset; k < Temp_val.Setter_offset + Temp_val.Setter_Len; k++)
                        {
                            // set in specific way
                            var Helper_val = State_helpers[k];
                            States[Helper_val.Id] = Helper_val.Op_type switch
                            {
                                Op_Type.Set => Helper_val.Val,
                                Op_Type.Add => States[Helper_val.Id] + Helper_val.Val,
                                Op_Type.Sub => States[Helper_val.Id] - Helper_val.Val,
                                Op_Type.Divide => States[Helper_val.Id] / Helper_val.Val,
                                Op_Type.Mul => States[Helper_val.Id] * Helper_val.Val,
                                _ => Helper_val.Val
                            };
                        }
                    }
                }

                for (int i = 0; i < Nodes_visited.Count; i++)
                {
                    var Temp_val = Nodes[Nodes_visited[i]];
                    Temp_val.Visited = true;
                    Nodes[Nodes_visited[i]] = Temp_val;
                }
            }
        }
        catch (Exception Ex)
        {
            Console.WriteLine(Ex.Message);
            return false;
        }

        return Nodes[Target_node_id].Visited;
    }

    // Enums -----------------------------

    public enum Op_Type : byte
    {
        Set, Add, Sub, Divide, Mul
    }

}
