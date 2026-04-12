window.BENCHMARK_DATA = {
  "lastUpdate": 1776006613871,
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
    ],
    "Latency Benchmark": [
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
        "date": 1775859718702,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1591,
            "range": "±0.59%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 8.4141,
            "range": "±3.72%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.7522,
            "range": "±1.47%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 40.0317,
            "range": "±3.42%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 2.383,
            "range": "±1.03%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 111.4248,
            "range": "±1.46%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 13.9919,
            "range": "±6.75%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 7.9107,
            "range": "±4.04%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 55.5026,
            "range": "±2.70%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 37.738,
            "range": "±1.51%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 164.2873,
            "range": "±0.77%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 114.847,
            "range": "±2.22%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 342.4303,
            "range": "±0.32%",
            "unit": "ms"
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
        "date": 1776006613844,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1392,
            "range": "±0.52%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 8.5281,
            "range": "±5.43%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.6645,
            "range": "±1.50%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 39.2845,
            "range": "±2.97%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 2.114,
            "range": "±1.04%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 113.3615,
            "range": "±3.51%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 11.9083,
            "range": "±7.10%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 6.4353,
            "range": "±6.11%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 45.725,
            "range": "±1.46%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 28.6827,
            "range": "±1.93%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 134.4729,
            "range": "±0.94%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 84.895,
            "range": "±3.22%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 345.8248,
            "range": "±1.67%",
            "unit": "ms"
          }
        ]
      }
    ]
  }
}