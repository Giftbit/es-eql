export class QueryBuilderError extends Error {

    constructor(message: string, public exp?: string) {
        super(message + (exp ? " " + exp : ""));
    }
}
