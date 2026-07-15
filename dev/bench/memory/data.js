window.BENCHMARK_DATA = {
  "lastUpdate": 1784095582073,
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
          "id": "9f1d304c560755a90a4bbc2bc64ac2f59008e163",
          "message": "fix: performance, security, test and correctness issues (#120)",
          "timestamp": "2026-04-18T12:51:40+02:00",
          "tree_id": "f8ea11a2ca1229034ddfdc9ac3ec1ec2b912a4ce",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/9f1d304c560755a90a4bbc2bc64ac2f59008e163"
        },
        "date": 1776509623709,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1381,
            "range": "±0.65%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 8.5299,
            "range": "±4.14%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.6654,
            "range": "±1.43%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 40.5174,
            "range": "±3.58%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 2.1294,
            "range": "±1.32%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 110.2632,
            "range": "±1.37%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 9.2665,
            "range": "±5.52%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 6.5188,
            "range": "±6.83%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 39.916,
            "range": "±4.70%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 29.1886,
            "range": "±1.98%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 106.7863,
            "range": "±3.58%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 87.5733,
            "range": "±5.07%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 329.5578,
            "range": "±0.39%",
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
          "id": "2b04296513d2158b20149de4f9ece15991eedbab",
          "message": "feat: opt-in mutation grouping (DSATUR) to reduce deployments (#122)",
          "timestamp": "2026-05-05T17:07:23+02:00",
          "tree_id": "cae4e73e62833ee95d4d034b0afbcde1e388d379",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/2b04296513d2158b20149de4f9ece15991eedbab"
        },
        "date": 1777993873870,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1322,
            "range": "±0.82%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 8.0447,
            "range": "±4.05%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.6229,
            "range": "±1.58%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 37.7558,
            "range": "±1.32%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 1.9969,
            "range": "±1.56%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 107.3939,
            "range": "±2.45%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 8.9893,
            "range": "±4.22%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 6.0727,
            "range": "±4.26%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 35.6008,
            "range": "±3.59%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 27.9523,
            "range": "±1.87%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 102.6459,
            "range": "±1.88%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 82.7277,
            "range": "±0.95%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 343.2571,
            "range": "±0.56%",
            "unit": "ms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "saman.attar@outlook.com",
            "name": "Saman Attar",
            "username": "SamanAttar"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "a6fb2b78e865c19a5cf06917a32477b13423f907",
          "message": "fix: restrict UOI mutations to identifier primaries only (#127)\n\nCo-authored-by: Sébastien Colladon <colladonsebastien@gmail.com>",
          "timestamp": "2026-06-01T14:48:25+02:00",
          "tree_id": "bee60ced4d5a1213d7c72c7c924ed39ae7a5e993",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/a6fb2b78e865c19a5cf06917a32477b13423f907"
        },
        "date": 1780318271195,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1549,
            "range": "±0.78%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 8.1199,
            "range": "±4.29%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.7224,
            "range": "±0.96%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 38.2028,
            "range": "±1.37%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 2.2961,
            "range": "±1.35%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 109.4993,
            "range": "±2.60%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 8.8962,
            "range": "±4.66%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 5.9884,
            "range": "±4.27%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 36.3833,
            "range": "±3.88%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 28.3041,
            "range": "±2.63%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 102.1714,
            "range": "±1.35%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 86.2907,
            "range": "±5.38%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 312.5352,
            "range": "±0.42%",
            "unit": "ms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "34024946+zanstaszek9@users.noreply.github.com",
            "name": "Stanislaw Zan",
            "username": "zanstaszek9"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "d904f59d763fc77f1a86ab3af273649f4ba39c14",
          "message": "fix: added handling for aggregated coverage when per-test data is una… (#129)\n\nCo-authored-by: Stanislaw Zan <szan@exactsciences.com>\nCo-authored-by: Sébastien Colladon <colladonsebastien@gmail.com>",
          "timestamp": "2026-07-15T08:04:23+02:00",
          "tree_id": "3b1bc0701ef6da1be275dcbfda764f07c0e01fe7",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/d904f59d763fc77f1a86ab3af273649f4ba39c14"
        },
        "date": 1784095582047,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1279,
            "range": "±0.58%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 7.5482,
            "range": "±4.05%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.5916,
            "range": "±0.62%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 39.6771,
            "range": "±7.06%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 1.9108,
            "range": "±2.64%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 99.4837,
            "range": "±1.04%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 8.0522,
            "range": "±4.06%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 6.2165,
            "range": "±5.83%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 32.7125,
            "range": "±3.15%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 31.3258,
            "range": "±7.06%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 94.611,
            "range": "±1.75%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 76.4135,
            "range": "±3.06%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 310.9431,
            "range": "±0.36%",
            "unit": "ms"
          }
        ]
      }
    ]
  }
}