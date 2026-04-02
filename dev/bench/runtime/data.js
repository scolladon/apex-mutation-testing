window.BENCHMARK_DATA = {
  "lastUpdate": 1775140079877,
  "repoUrl": "https://github.com/scolladon/apex-mutation-testing",
  "entries": {
    "Runtime Benchmark": [
      {
        "commit": {
          "author": {
            "email": "colladonsebastien@gmail.com",
            "name": "Sebastien",
            "username": "scolladon"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "699884b7b7929418efb489be5a567a400a13fb5d",
          "message": "feat(perf): add comprehensive performance testing infrastructure (#115)",
          "timestamp": "2026-04-02T16:25:51+02:00",
          "tree_id": "64e35e982386a415accd6a6d98df1047527ee20b",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/699884b7b7929418efb489be5a567a400a13fb5d"
        },
        "date": 1775140079547,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 6056,
            "range": "±0.71%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 106,
            "range": "±5.26%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1294,
            "range": "±1.56%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 23,
            "range": "±2.35%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 402,
            "range": "±1.61%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 8,
            "range": "±3.50%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 77,
            "range": "±5.89%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 146,
            "range": "±5.26%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 19,
            "range": "±3.33%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 31,
            "range": "±2.89%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 6,
            "range": "±2.82%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 10,
            "range": "±4.18%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±0.97%",
            "unit": "ops/sec"
          }
        ]
      }
    ]
  }
}