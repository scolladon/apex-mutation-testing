window.BENCHMARK_DATA = {
  "lastUpdate": 1775140080658,
  "repoUrl": "https://github.com/scolladon/apex-mutation-testing",
  "entries": {
    "Memory Benchmark": [
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
        "date": 1775140080632,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1651,
            "range": "±0.71%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 9.4619,
            "range": "±5.26%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.7727,
            "range": "±1.56%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 43.8682,
            "range": "±2.35%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 2.4859,
            "range": "±1.61%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 131.2836,
            "range": "±3.50%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 13.0348,
            "range": "±5.89%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 6.8537,
            "range": "±5.26%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 53.7074,
            "range": "±3.33%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 32.1478,
            "range": "±2.89%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 156.1271,
            "range": "±2.82%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 97.5843,
            "range": "±4.18%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 381.0633,
            "range": "±0.97%",
            "unit": "ms"
          }
        ]
      }
    ]
  }
}