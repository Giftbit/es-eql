import * as chai from "chai";
import * as esQueryBuilder from "./index";
import {QueryBuilderError} from "./QueryBuilderError";

// temp hack because chai.assert changed in 4.0 but the declaration file hasn't yet
chai.assert.deepProperty = (chai.assert as any).nestedProperty;

describe("esQueryBuilder", () => {
    it("doesn't allow assignment expressions", () => {
        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("value = 100");
        }, QueryBuilderError);

        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("value += 100");
        }, QueryBuilderError);

        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("value -= 100");
        }, QueryBuilderError);

        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("value++");
        }, QueryBuilderError);

        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("value--");
        }, QueryBuilderError);
    });

    it("doesn't allow compound expressions", () => {
        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("5 < 6, 6 < 6");
        }, QueryBuilderError);
    });

    it("doesn't allow array expressions", () => {
        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("[1, 2, 3]");
        }, QueryBuilderError);
    });

    it("doesn't allow math expressions", () => {
        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("1 + 2");
        }, QueryBuilderError);
        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("3 - 4");
        }, QueryBuilderError);
        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("5 * 6");
        }, QueryBuilderError);
        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("6 / 7");
        }, QueryBuilderError);
        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("7 << 8");
        }, QueryBuilderError);
        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("8 >> 9");
        }, QueryBuilderError);
        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("9 >>> 10");
        }, QueryBuilderError);
        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("11 % 12");
        }, QueryBuilderError);
    });

    it("doesn't allow undefined operators", () => {
        chai.assert.throw(() => {
            esQueryBuilder.buildElasticsearchQuery("value ^ 50");
        }, QueryBuilderError);
    });

    describe("!", () => {
        it("supports existence", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("value");
            chai.assert.deepEqual(query, {
                exists: {
                    field: "value"
                }
            });
        });

        it("supports !! existence and simplifies it", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("!!value");
            chai.assert.deepEqual(query, {
                exists: {
                    field: "value"
                }
            });
        });

        it("supports non-existence", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("!value");
            chai.assert.deepEqual(query, {
                bool: {
                    must_not: {
                        exists: {
                            field: "value"
                        }
                    }
                }
            });
        });

        it("supports !!! non-existence and simplifies it", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("!!!value");
            chai.assert.deepEqual(query, {
                bool: {
                    must_not: {
                        exists: {
                            field: "value"
                        }
                    }
                }
            });
        });
    });

    it("supports ==", () => {
        const query = esQueryBuilder.buildElasticsearchQuery("value == 200");
        chai.assert.deepEqual(query, {
            match: {
                value: 200
            }
        });

        const yodaQuery = esQueryBuilder.buildElasticsearchQuery("200 == value");
        chai.assert.deepEqual(yodaQuery, {
            match: {
                value: 200
            }
        });
    });

    it("supports !=", () => {
        const query = esQueryBuilder.buildElasticsearchQuery("value != 200");
        chai.assert.deepEqual(query, {
            bool: {
                must_not: {
                    match: {
                        value: 200
                    }
                }
            }
        });

        const yodaQuery = esQueryBuilder.buildElasticsearchQuery("200 != value");
        chai.assert.deepEqual(yodaQuery, {
            bool: {
                must_not: {
                    match: {
                        value: 200
                    }
                }
            }
        });
    });

    describe("*=", () => {
        it("supports *=", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("firstName *= \"Jeffery*\"");
            chai.assert.deepEqual(query, {
                wildcard: {
                    firstName: "Jeffery*"
                }
            });

            const yodaQuery = esQueryBuilder.buildElasticsearchQuery("\"Jeffery*\" *= firstName");
            chai.assert.deepEqual(yodaQuery, {
                wildcard: {
                    firstName: "Jeffery*"
                }
            });
        });

        it("supports !*=", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("firstName !*= \"Jeffery*\"");
            chai.assert.deepEqual(query, {
                bool: {
                    must_not: {
                        wildcard: {
                            firstName: "Jeffery*"
                        }
                    }
                }
            });

            const yodaQuery = esQueryBuilder.buildElasticsearchQuery("\"Jeffery*\" !*= firstName");
            chai.assert.deepEqual(yodaQuery, {
                bool: {
                    must_not: {
                        wildcard: {
                            firstName: "Jeffery*"
                        }
                    }
                }
            });
        });

        it("doesn't allow *= when disabled", () => {
            chai.assert.throw(() => {
                esQueryBuilder.buildElasticsearchQuery("firstName *= 100", {
                    wildcard: {
                        enabled: false
                    }
                });
            }, QueryBuilderError);
        });

        it("doesn't allow *= against numbers", () => {
            chai.assert.throw(() => {
                esQueryBuilder.buildElasticsearchQuery("firstName *= 100");
            }, QueryBuilderError);
        });

        it("doesn't allow *= against boolean", () => {
            chai.assert.throw(() => {
                esQueryBuilder.buildElasticsearchQuery("firstName *= true");
            }, QueryBuilderError);
        });

        it("doesn't allow short *= when configured", () => {
            chai.assert.throw(() => {
                esQueryBuilder.buildElasticsearchQuery("firstName *= \"*\"", {
                    wildcard: {
                        minCharacters: 5
                    }
                });
            }, QueryBuilderError);
        });
    });

    describe("~=", () => {
        it("supports ~=", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("firstName ~= \"Jeffery\"");
            chai.assert.deepEqual(query, {
                fuzzy: {
                    firstName: "Jeffery"
                }
            });

            const yodaQuery = esQueryBuilder.buildElasticsearchQuery("\"Jeffery\" ~= firstName");
            chai.assert.deepEqual(yodaQuery, {
                fuzzy: {
                    firstName: "Jeffery"
                }
            });
        });

        it("supports !~=", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("firstName !~= \"Jeffery\"");
            chai.assert.deepEqual(query, {
                bool: {
                    must_not: {
                        fuzzy: {
                            firstName: "Jeffery"
                        }
                    }
                }
            });

            const yodaQuery = esQueryBuilder.buildElasticsearchQuery("\"Jeffery\" !~= firstName");
            chai.assert.deepEqual(yodaQuery, {
                bool: {
                    must_not: {
                        fuzzy: {
                            firstName: "Jeffery"
                        }
                    }
                }
            });
        });

        it("doesn't allow ~= when disabled", () => {
            chai.assert.throw(() => {
                esQueryBuilder.buildElasticsearchQuery("firstName ~= 100", {
                    fuzzy: {
                        enabled: false
                    }
                });
            }, QueryBuilderError);
        });

        it("doesn't allow ~= against numbers", () => {
            chai.assert.throw(() => {
                esQueryBuilder.buildElasticsearchQuery("firstName ~= 100");
            }, QueryBuilderError);
        });

        it("doesn't allow ~= against boolean", () => {
            chai.assert.throw(() => {
                esQueryBuilder.buildElasticsearchQuery("firstName ~= false");
            }, QueryBuilderError);
        });

        it("doesn't allow short ~= when configured", () => {
            chai.assert.throw(() => {
                esQueryBuilder.buildElasticsearchQuery("firstName ~= \"J\"", {
                    fuzzy: {
                        minCharacters: 5
                    }
                });
            }, QueryBuilderError);
        });
    });

    describe("range", () => {
        it("supports <", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("value < 200");
            chai.assert.deepEqual(query, {
                range: {
                    value: {
                        lt: 200
                    }
                }
            });

            const yodaQuery = esQueryBuilder.buildElasticsearchQuery("200 < value");
            chai.assert.deepEqual(yodaQuery, {
                range: {
                    value: {
                        gt: 200
                    }
                }
            });
        });

        it("supports >", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("value > 200");
            chai.assert.deepEqual(query, {
                range: {
                    value: {
                        gt: 200
                    }
                }
            });

            const yodaQuery = esQueryBuilder.buildElasticsearchQuery("200 > value");
            chai.assert.deepEqual(yodaQuery, {
                range: {
                    value: {
                        lt: 200
                    }
                }
            });
        });

        it("supports <=", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("value <= 200");
            chai.assert.deepEqual(query, {
                range: {
                    value: {
                        lte: 200
                    }
                }
            });

            const yodaQuery = esQueryBuilder.buildElasticsearchQuery("200 <= value");
            chai.assert.deepEqual(yodaQuery, {
                range: {
                    value: {
                        gte: 200
                    }
                }
            });
        });

        it("supports >=", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("value >= 200");
            chai.assert.deepEqual(query, {
                range: {
                    value: {
                        gte: 200
                    }
                }
            });

            const yodaQuery = esQueryBuilder.buildElasticsearchQuery("200 >= value");
            chai.assert.deepEqual(yodaQuery, {
                range: {
                    value: {
                        lte: 200
                    }
                }
            });
        });
    });

    describe("||", () => {
        it("supports ||", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("value < 200 || value > 500");
            chai.assert.deepProperty(query, "bool.should");
            chai.assert.sameDeepMembers(query.bool.should, [
                {
                    range: {
                        value: {
                            lt: 200
                        }
                    }
                },
                {
                    range: {
                        value: {
                            gt: 500
                        }
                    }
                }
            ]);
        });

        it("supports ! across ||", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("!(value < 200 || value > 500)");
            chai.assert.deepProperty(query, "bool.must_not.bool.should");
            chai.assert.sameDeepMembers(query.bool.must_not.bool.should, [
                {
                    range: {
                        value: {
                            lt: 200
                        }
                    }
                },
                {
                    range: {
                        value: {
                            gt: 500
                        }
                    }
                }
            ]);
        });
    });

    describe("&&", () => {
        it("supports &&", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("value > 200 && value < 500");
            chai.assert.deepProperty(query, "bool.must");
            chai.assert.sameDeepMembers(query.bool.must, [
                {
                    range: {
                        value: {
                            gt: 200
                        }
                    }
                },
                {
                    range: {
                        value: {
                            lt: 500
                        }
                    }
                }
            ]);
        });

        it("supports ! across &&", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("!(value > 200 && value < 500)");
            chai.assert.deepProperty(query, "bool.must_not.bool.must");
            chai.assert.sameDeepMembers(query.bool.must_not.bool.must, [
                {
                    range: {
                        value: {
                            gt: 200
                        }
                    }
                },
                {
                    range: {
                        value: {
                            lt: 500
                        }
                    }
                }
            ]);
        });
    });

    describe("parentheses", () => {
        it("supports parentheses", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("(value < 200)");
            chai.assert.deepEqual(query, {
                range: {
                    value: {
                        lt: 200
                    }
                }
            });
        });

        it("doesn't allow unmatched parentheses", () => {
            chai.assert.throw(() => {
                esQueryBuilder.buildElasticsearchQuery("(value < 6");
            }, QueryBuilderError);
            chai.assert.throw(() => {
                esQueryBuilder.buildElasticsearchQuery("value < 6)");
            }, QueryBuilderError);
            chai.assert.throw(() => {
                esQueryBuilder.buildElasticsearchQuery(")value < 6(");
            }, QueryBuilderError);
        });

        it("simplifies !! over parentheses", () => {
            const query = esQueryBuilder.buildElasticsearchQuery("!!(value < 200)");
            chai.assert.deepEqual(query, {
                range: {
                    value: {
                        lt: 200
                    }
                }
            });
        });
    });

    describe("identifiers", () => {
        it("allows valid identifiers", () => {
            esQueryBuilder.buildElasticsearchQuery("value > 200", {
                fieldVerifier: field => field === "value"
            });
        });

        it("allows valid member identifiers", () => {
            function isValid(field: string): boolean {
                switch (field) {
                    case "x":
                    case "z.a":
                    case "z.b":
                    case "z.c":
                        return true;
                }
                return false;
            }

            esQueryBuilder.buildElasticsearchQuery("x == 4 && z.a == 6 && !z.b && z.c", {
                fieldVerifier: isValid
            });
        });

        it("doesn't allow invalid identifiers", () => {
            chai.assert.throw(() => {
                esQueryBuilder.buildElasticsearchQuery("value > 200", {
                    fieldVerifier: field => field === "x"
                });
            }, QueryBuilderError);
        });

        it("doesn't allow invalid member identifiers", () => {
            function isValid(field: string): boolean {
                switch (field) {
                    case "x":
                    case "z.a":
                    case "z.b":
                    case "z.c":
                        return true;
                }
                return false;
            }

            chai.assert.throw(() => {
                esQueryBuilder.buildElasticsearchQuery("x == 4 && z.a == 6 && !z.b && z.c && z == 4", {
                    fieldVerifier: isValid
                });
            }, QueryBuilderError);
        });
    });
});
