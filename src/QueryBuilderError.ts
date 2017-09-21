import * as jsep from "jsep";

export class QueryBuilderError extends Error {

    constructor(message: string, exp?: jsep.Expression) {
        super(message + (exp ? " " + QueryBuilderError.expressionToString(exp) : ""));
    }

    /**
     * Get the Expression as parsed in string form.
     * @param exp
     * @returns a string representation of the Expression
     */
    static expressionToString(exp: jsep.Expression): string {
        switch (exp.type) {
            case "ArrayExpression":
                return `[${(exp as jsep.ArrayExpression).elements.map(QueryBuilderError.expressionToString).join(", ")}]`;
            case "BinaryExpression":
            case "LogicalExpression":
                const binaryExpression = exp as jsep.BinaryExpression | jsep.LogicalExpression;
                return `${QueryBuilderError.expressionToString(binaryExpression.left)} ${binaryExpression.operator} ${QueryBuilderError.expressionToString(binaryExpression.right)}`;
            case "CallExpression":
                return `${QueryBuilderError.expressionToString((exp as jsep.CallExpression).callee)}(${(exp as jsep.CallExpression).arguments.map(QueryBuilderError.expressionToString).join(", ")})`;
            case "Compound":
                return (exp as jsep.Compound).body.map(QueryBuilderError.expressionToString).join(", ");
            case "ConditionalExpression":
                return `${(exp as jsep.ConditionalExpression).test} ? ${(exp as jsep.ConditionalExpression).consequent} : ${(exp as jsep.ConditionalExpression).alternate}`;
            case "Identifier":
                return (exp as jsep.Identifier).name;
            case "Literal":
                return (exp as jsep.Literal).value.toString();
            case "MemberExpression":
                if ((exp as jsep.MemberExpression).computed) {
                    return `${QueryBuilderError.expressionToString((exp as jsep.MemberExpression).object)}[${QueryBuilderError.expressionToString((exp as jsep.MemberExpression).property)}]`;
                } else {
                    return `${QueryBuilderError.expressionToString((exp as jsep.MemberExpression).object)}.${QueryBuilderError.expressionToString((exp as jsep.MemberExpression).property)}`;
                }
            case "ThisExpression":
                return "this";
            case "UnaryExpression":
                const unaryExpression = exp as jsep.UnaryExpression;
                const prefix = unaryExpression.prefix ? unaryExpression.operator : "";
                const argument = QueryBuilderError.expressionToString(unaryExpression.argument);
                const postfix = unaryExpression.prefix ? "" : unaryExpression.operator;
                return `${prefix}(${argument})${postfix}`;
            default:
                // User should never see this.
                throw new Error(`Unprocessable jsep expression type: ${exp.type}.`);
        }
    }
}
