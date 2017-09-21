# es-eql
Elasticsearch Easy Query Builder

Builds simple Elasticsearch queries using standard programming syntax.  Not all queries that can be expressed in Elasticsearch are possible, but those that are possible are simple to write.  This can be used to expose Elasticsearch queries to a moderately technical user with little extra training.

## Installation

es-eql is your typical NPM package.

```bash
npm install --save es-eql
```

## Usage

### A basic example

```typescript
import * as elasticsearch from "elasticsearch";
import * as eseql from "es-eql";

const es = new elasticsearch.Client({
    apiVersion: "5.1",
    hosts: "myhostname"
});

es.search({
    index: "myindex",
    type: "mytype",
    body: eseql.buildElasticsearchQuery("environment == 'production' && (tag == 'http' || tag == 'ftp')")
}).then(result => {
    console.log("search result", result.hits.hits.map(d => d._source));
}, error => {
    console.log("search error", error);
});
```

### Writing easy queries

The following operators are supported:

| symbol | operation             |
|:-------|:----------------------|
| ()     | operation grouping    |
| !      | logical negation      |
| &&     | logical and           |
| &#124;&#124;     | logical or            |
| ==     | logical equals        |
| !=     | logical not equals    |
| *=     | wildcard match        |
| !*=    | wildcard not match    |
| ~=     | fuzzy match           |
| !~=    | fuzzy not match       |
| <      | less than             |
| <=     | less than or equals   |
| >      | greater than          |
| >=     | greater than or equals|

All comparison operators must work against a literal value.  For example `threat.level > 5` and `flavor == 'chocolate'` are valid.  `flavor == color` is not valid because Elasticsearch does not allow comparing values within a document.

### Field verification

`buildElasticsearchQuery` accepts an options param that can verify whether a field name is valid.

eg:

```typescript
const options = {
    fieldVerifier: function (field) {
       switch (field) {
           case "x":
           case "z.a":
           case "z.b":
           case "z.c":
               return true;
       }
       return false;
   }
};

// valid
eseql.buildElasticsearchQuery("x == 1");    
eseql.buildElasticsearchQuery("z.a == 1 && z.b != -2");

// invalid
eseql.buildElasticsearchQuery("y == 9");

```
