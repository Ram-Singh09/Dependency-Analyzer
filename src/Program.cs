var Analyzer = new Dependency_Analyzer();

// builder setup
var Builder = WebApplication.CreateBuilder(args);
Builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.IncludeFields = true;
});

var App = Builder.Build();

// app setup
App.UseDefaultFiles(); // auto use index file of html
App.UseStaticFiles(); // use front end too by putting in wwwroot

// mappings
App.MapPost("/Analyzer/Evaluate", (Analyzer_Args Args) =>
{
    var State = Analyzer.Set_Data(Args);
    if (State != Result_State.Success) return Results.Problem(Get_Error_Msg(State));

    var Lis = new List<int>();
    State = Analyzer.Analyze(Lis);
    if (State != Result_State.Success) return Results.Problem(Get_Error_Msg(State));

    return Results.Ok(Lis);
});

App.Run();

static string Get_Error_Msg(Result_State X)
{
    return X switch
    {
        Result_State.Success => "Operation Completed",
        Result_State.Data_Null => "Data provided is null",
        Result_State.Target_Node_Invalid => "Target node is not valid",
        Result_State.Analysis_Failed => "Failled analysis, contact dev team",
        _ => "Unknown Error"
    };
}
