import * as jsep from "jsep";
import {QueryBuilderError} from "./QueryBuilderError";
import {BuildElasticsearchQueryOptions} from "./BuildElasticsearchQueryOptions";

jsep.removeUnaryOp("~");
jsep.removeBinaryOp("|");
jsep.removeBinaryOp("^");
jsep.removeBinaryOp("&");
jsep.removeBinaryOp("===");
jsep.removeBinaryOp("!==");
jsep.removeBinaryOp("<<");
jsep.removeBinaryOp(">>");
jsep.removeBinaryOp(">>>");
jsep.removeBinaryOp("+");
jsep.removeBinaryOp("-");
jsep.removeBinaryOp("*");
jsep.removeBinaryOp("/");
jsep.removeBinaryOp("%");
jsep.addBinaryOp("*=", 8);  // wildcard match
jsep.addBinaryOp("!*=", 8); // not wildcard match
jsep.addBinaryOp("~=", 8);  // fuzzy match
jsep.addBinaryOp("!~=", 8); // not fuzzy match

// At this point we're left with
//  unary: - + !
//  binary: || && == != *= !*= ~= !~= < > <= >=

export function buildElasticsearchQuery(queryString: string, options: BuildElasticsearchQueryOptions = {}): any {
    try {
        const exp = jsep(queryString);
        verifyExpression(exp, options);
        return expressionToQuery(exp, options);
    } catch (err) {
        throw new QueryBuilderError(err.message);
    }
}

/**
 * Throw an Error for unsupported jsep expression types.
 */
function verifyExpression(exp: jsep.Expression, options: BuildElasticsearchQueryOptions): void {
    switch (exp.type) {
        case "ArrayExpression":
            throw new QueryBuilderError("Arrays are not supported.", exp);
        case "BinaryExpression":
            verifyExpression((exp as jsep.BinaryExpression).left, options);
            verifyExpression((exp as jsep.BinaryExpression).right, options);
            break;
        case "CallExpression":
            throw new QueryBuilderError("Function calls are not supported.", exp);
        case "Compound":
            throw new QueryBuilderError("Compound statements are not supported.", exp);
        case "Identifier":
            if (options.fieldVerifier && !options.fieldVerifier((exp as jsep.Identifier).name)) {
                throw new QueryBuilderError(`${(exp as jsep.Identifier).name} is not a known field.`, exp);
            }
            break;
        case "Literal":
            break;
        case "LogicalExpression":
            verifyExpression((exp as jsep.LogicalExpression).left, options);
            verifyExpression((exp as jsep.LogicalExpression).right, options);
            break;
        case "MemberExpression":
            const memberExpressionIdentifier = memberExpressionToIdentifier(exp as jsep.MemberExpression, options).name;
            if (options.fieldVerifier && !options.fieldVerifier(memberExpressionIdentifier)) {
                throw new QueryBuilderError(`${memberExpressionIdentifier} is not a known identifier.`, exp);
            }
            return;
        case "ThisExpression":
            throw new QueryBuilderError("'this' type is not supported.", exp);
        case "UnaryExpression":
            verifyExpression((exp as jsep.UnaryExpression).argument, options);
            break;
        default:
            throw new Error(`Unknown jsep expression type: ${exp.type}.`);
    }
}

/**
 * Translate the jsep Expression to an Elasticsearch query body.
 * At this point the only valid expression types are:
 *  BinaryExpression, Identifier, Literal, LogicalExpression, MemberExpression, UnaryExpression
 */
function expressionToQuery(exp: jsep.Expression, options: BuildElasticsearchQueryOptions): any {
    switch (exp.type) {
        case "BinaryExpression":
            return binaryExpressionToQuery(exp as jsep.BinaryExpression, options);
        case "Identifier":
            return identifierToQuery(exp as jsep.Identifier, options);
        case "Literal":
            throw new QueryBuilderError(`Expected an expression.`, exp);
        case "LogicalExpression":
            return logicalExpressionToQuery(exp as jsep.LogicalExpression, options);
        case "MemberExpression":
            return identifierToQuery(memberExpressionToIdentifier(exp as jsep.MemberExpression, options), options);
        case "UnaryExpression":
            return unaryExpressionToQuery(exp as jsep.UnaryExpression, options);
        default:
            // Programmer error.
            throw new Error(`Unknown (post verify) jsep expression type: ${exp.type}.`);
    }
}

/**
 * == != === !== < > <= >= *= !*= ~= !~=
 * Must relate an Identifier to a Literal.
 */
function binaryExpressionToQuery(exp: jsep.BinaryExpression, options: BuildElasticsearchQueryOptions): any {
    const identifier = getBinaryExpressionIdentifier(exp, options).name;
    const literal = getBinaryExpressionLiteral(exp, options).value;
    const yoda = exp.left.type === "Literal";   // eg: 5 == value
    const negate = exp.operator[0] === "!";

    switch (exp.operator) {
        case "==":
        case "!=":
            return maybeNegateQuery({
                match: {
                    [identifier]: literal
                }
            }, negate);
        case "*=":
        case "!*=":
            if (typeof literal !== "string") {
                throw new QueryBuilderError(`Cannot apply wildcard operator ${exp.operator} to type ${typeof literal}.`, exp);
            }
            if (options.wildcard && options.wildcard.enabled === false) {
                throw new QueryBuilderError(`Wildcard search is disabled.`, exp);
            }
            if (options.wildcard && options.wildcard.minCharacters) {
                const unwildCharacters = ((literal as string).match(/[^*?]/g) || []).length;
                if (unwildCharacters < options.wildcard.minCharacters) {
                    throw new QueryBuilderError(`Wildcard search must have at least ${options.wildcard.minCharacters} non-wildcard characters.`, exp);
                }
            }
            return maybeNegateQuery({
                wildcard: {
                    [identifier]: literal
                }
            }, negate);
        case "~=":
        case "!~=":
            if (typeof literal !== "string") {
                throw new QueryBuilderError(`Cannot apply fuzzy operator ${exp.operator} to type ${typeof literal}.`, exp);
            }
            if (options.fuzzy && options.fuzzy.enabled === false) {
                throw new QueryBuilderError(`Fuzzy search is disabled.`, exp);
            }
            if (options.fuzzy && options.fuzzy.minCharacters) {
                if ((literal as string).length < options.fuzzy.minCharacters) {
                    throw new QueryBuilderError(`Fuzzy search must have at least ${options.fuzzy.minCharacters} characters.`, exp);
                }
            }
            return maybeNegateQuery({
                fuzzy: {
                    [identifier]: literal
                }
            }, negate);
        case "<":
            return {
                range: {
                    [identifier]: {
                        [yoda ? "gt" : "lt"]: literal
                    }
                }
            };
        case ">":
            return {
                range: {
                    [identifier]: {
                        [yoda ? "lt" : "gt"]: literal
                    }
                }
            };
        case "<=":
            return {
                range: {
                    [identifier]: {
                        [yoda ? "gte" : "lte"]: literal
                    }
                }
            };
        case ">=":
            return {
                range: {
                    [identifier]: {
                        [yoda ? "lte" : "gte"]: literal
                    }
                }
            };
        default:
            // Programmer error.
            throw new Error(`Unhandled binary operator: ${exp.operator}.`);
    }
}

function getBinaryExpressionIdentifier(exp: jsep.BinaryExpression, options: BuildElasticsearchQueryOptions): jsep.Identifier {
    if (exp.left.type === "Identifier") {
        return exp.left as jsep.Identifier;
    } else if (exp.right.type === "Identifier") {
        return exp.right as jsep.Identifier;
    } else if (exp.left.type === "MemberExpression") {
        return memberExpressionToIdentifier(exp.left as jsep.MemberExpression, options);
    } else if (exp.right.type === "MemberExpression") {
        return memberExpressionToIdentifier(exp.right as jsep.MemberExpression, options);
    }
    throw new QueryBuilderError(`Expression does not contain an identifier to compare against.`, exp);
}

function getBinaryExpressionLiteral(exp: jsep.BinaryExpression, options: BuildElasticsearchQueryOptions): jsep.Literal {
    if (exp.left.type === "Literal") {
        return exp.left as jsep.Literal;
    } else if (exp.right.type === "Literal") {
        return exp.right as jsep.Literal;
    } else if (exp.left.type === "UnaryExpression" && (exp.left as jsep.UnaryExpression).argument.type === "Literal") {
        return unaryExpressionToLiteral(exp.left as jsep.UnaryExpression, options);
    } else if (exp.right.type === "UnaryExpression" && (exp.right as jsep.UnaryExpression).argument.type === "Literal") {
        return unaryExpressionToLiteral(exp.right as jsep.UnaryExpression, options);
    }
    throw new QueryBuilderError(`Expression does not contain a literal (boolean, number, string) to compare against.`, exp);
}

/**
 * Identifier as an expression turns into exists, just like JS does.
 */
function identifierToQuery(exp: jsep.Identifier, options: BuildElasticsearchQueryOptions): any {
    return {
        exists: {
            field: exp.name
        }
    };
}

/**
 * || &&
 * Each child must be a binary or logical expression.
 */
function logicalExpressionToQuery(exp: jsep.LogicalExpression, options: BuildElasticsearchQueryOptions): any {
    // If left or right are the same operator they could be added into the array.
    // That might speed up Elasticsearch but it's not worth my time right now.
    switch (exp.operator) {
        case "||":
            return {
                bool: {
                    should: [
                        expressionToQuery(exp.left, options),
                        expressionToQuery(exp.right, options)
                    ]
                }
            };
        case "&&":
            return {
                bool: {
                    must: [
                        expressionToQuery(exp.left, options),
                        expressionToQuery(exp.right, options)
                    ]
                }
            };
        default:
            // Programmer error.
            throw new Error(`Unhandled logical operator: ${exp.operator}.`);
    }
}

function unaryExpressionToQuery(exp: jsep.UnaryExpression, options: BuildElasticsearchQueryOptions): any {
    switch (exp.operator) {
        case "-":
        case "+":
            throw new QueryBuilderError(`Expression must be a binary expression.`, exp);
        case "!": {
            switch (exp.argument.type) {
                case "BinaryExpression":
                case "LogicalExpression":
                case "Identifier":
                    return maybeNegateQuery(expressionToQuery(exp.argument, options), true);
                case "MemberExpression":
                    return maybeNegateQuery(expressionToQuery(exp.argument, options), true);
                case "UnaryExpression":
                    if ((exp.argument as jsep.UnaryExpression).operator === "!") {
                        return expressionToQuery((exp.argument as jsep.UnaryExpression).argument, options);
                    } else {
                        return maybeNegateQuery(expressionToQuery(exp.argument, options), true);
                    }
                default:
                    throw new QueryBuilderError(`Cannot apply unary operator ${exp.operator}.`, exp);
            }
        }
        default:
            // Programmer error.
            throw new Error(`Unhandled unary operator ${exp.operator}.`);
    }
}

/**
 * Convert a Unary wrapping a literal to a literal (which may now have a sign).
 */
function unaryExpressionToLiteral(exp: jsep.UnaryExpression, options: BuildElasticsearchQueryOptions): jsep.Literal {
    if (exp.argument.type !== "Literal") {
        throw new QueryBuilderError(`Unary expression must have a literal argument.`, exp);
    }
    const argument = exp.argument as jsep.Literal;
    const argumentValueType = typeof argument.value;

    switch (exp.operator) {
        case "-":
        case "+":
            if (argumentValueType !== "number") {
                throw new QueryBuilderError(`Cannot apply unary operator ${exp.operator} to type ${argumentValueType}.`, exp);
            }
            const value = exp.operator === "-" ? -argument.value : +argument.value;
            return {
                value: value,
                type: "Literal",
                raw: JSON.stringify(value)
            };
        case "!":
            throw new QueryBuilderError(`Cannot apply unary operator ${exp.operator} to type ${argumentValueType}.`, exp);
        default:
            // Programmer error.
            throw new Error(`Unhandled unary operator ${exp.operator}.`);
    }
}

/**
 * Collapse a non-computed chain of member expressions to a single identifier of the form a.b.c.
 */
function memberExpressionToIdentifier(exp: jsep.MemberExpression, options: BuildElasticsearchQueryOptions): jsep.Identifier {
    if (exp.computed) {
        throw new QueryBuilderError("Computed member expressions are not supported.", exp);
    }
    if (exp.object.type !== "Identifier") {
        throw new QueryBuilderError(`Unsupported member expression object type ${exp.object.type}.`, exp);
    }

    switch (exp.property.type) {
        case "Identifier":
            return {
                type: "Identifier",
                name: `${(exp.object as jsep.Identifier).name}.${(exp.property as jsep.Identifier).name}`
            };
        case "MemberExpression":
            return {
                type: "Identifier",
                name: `${(exp.object as jsep.Identifier).name}.${memberExpressionToIdentifier(exp.property as jsep.MemberExpression, options).name}`
            };
        default:
            throw new QueryBuilderError(`Unsupported member expression property type ${exp.object.type}.`, exp);
    }
}

function maybeNegateQuery(query: Object, negate: boolean): Object {
    if (negate) {
        return {
            bool: {
                must_not: query
            }
        };
    } else {
        return query;
    }
}
