window.BENCHMARK_DATA = {
  "lastUpdate": 1776006613157,
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
      },
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
          "id": "17b0003d617ce596cd4e6e5af589095e0f205e97",
          "message": "chore(ci): compare perf benchmarks on same runner to eliminate CI noise (#118)",
          "timestamp": "2026-04-11T00:20:06+02:00",
          "tree_id": "6486f861fd728edd51ac1986b9ec143d576b6da3",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/17b0003d617ce596cd4e6e5af589095e0f205e97"
        },
        "date": 1775859717684,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 6285,
            "range": "±0.59%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 119,
            "range": "±3.72%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1329,
            "range": "±1.47%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 25,
            "range": "±3.42%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 420,
            "range": "±1.03%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 9,
            "range": "±1.46%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 71,
            "range": "±6.75%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 126,
            "range": "±4.04%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 18,
            "range": "±2.70%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 26,
            "range": "±1.51%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 6,
            "range": "±0.77%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 9,
            "range": "±2.22%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±0.32%",
            "unit": "ops/sec"
          }
        ]
      },
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
          "id": "d1729f47b554e7b7ad870463c19a0daa563f9389",
          "message": "ci(perf): post same-runner perf comparison as PR comment (#119)",
          "timestamp": "2026-04-12T17:08:24+02:00",
          "tree_id": "6b1e9ed8a7d3a286b00e2068c28fbccd7eab223c",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/d1729f47b554e7b7ad870463c19a0daa563f9389"
        },
        "date": 1776006612926,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 7186,
            "range": "±0.52%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 117,
            "range": "±5.43%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1505,
            "range": "±1.50%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 25,
            "range": "±2.97%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 473,
            "range": "±1.04%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 9,
            "range": "±3.51%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 84,
            "range": "±7.10%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 155,
            "range": "±6.11%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 22,
            "range": "±1.46%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 35,
            "range": "±1.93%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 7,
            "range": "±0.94%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 12,
            "range": "±3.22%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±1.67%",
            "unit": "ops/sec"
          }
        ]
      }
    ]
  }
}