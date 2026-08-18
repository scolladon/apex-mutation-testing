window.BENCHMARK_DATA = {
  "lastUpdate": 1787068303197,
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
          "id": "77828d88df121f57f62f40b4f5997d9683298727",
          "message": "chore: upgrade node engine floor to 22 with 22/24/26 support (#132)",
          "timestamp": "2026-07-15T13:04:53+02:00",
          "tree_id": "3979e68b0f917f505c5adb44d4233a3191689c13",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/77828d88df121f57f62f40b4f5997d9683298727"
        },
        "date": 1784113641482,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1391,
            "range": "±0.37%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 7.8582,
            "range": "±4.51%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.6467,
            "range": "±0.33%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 37.7039,
            "range": "±4.14%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 2.1228,
            "range": "±1.81%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 100.1519,
            "range": "±0.38%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 7.9514,
            "range": "±5.09%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 6.0007,
            "range": "±6.93%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 32.804,
            "range": "±1.96%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 26.3468,
            "range": "±2.35%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 98.2233,
            "range": "±2.68%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 77.6769,
            "range": "±1.72%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 340.9929,
            "range": "±1.25%",
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
          "id": "99947d47ee86c40d2e9dc25fa256f278dbcc8e44",
          "message": "fix: allowlist re2 install script for npm 12 (#133)",
          "timestamp": "2026-07-15T15:28:23+02:00",
          "tree_id": "a9ab1d4a4e94ad522b7f5f54472a6babd20f415e",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/99947d47ee86c40d2e9dc25fa256f278dbcc8e44"
        },
        "date": 1784122225317,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1346,
            "range": "±0.37%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 8.1226,
            "range": "±5.01%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.627,
            "range": "±0.52%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 37.3633,
            "range": "±2.10%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 2.0457,
            "range": "±2.14%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 102.169,
            "range": "±0.85%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 10.0495,
            "range": "±7.17%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 5.8232,
            "range": "±5.05%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 32.9863,
            "range": "±3.20%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 27.2234,
            "range": "±3.33%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 97.4345,
            "range": "±3.06%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 80.1214,
            "range": "±3.29%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 336.6452,
            "range": "±0.20%",
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
          "id": "fadb73c394a9b17d8b5c44535de8595ab3f354d7",
          "message": "fix: replace re2 with re2js to eliminate npm 12 install-script friction (#135)",
          "timestamp": "2026-07-15T17:44:15+02:00",
          "tree_id": "5b18f8b07034216f23046fad20e56cbb59c90f95",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/fadb73c394a9b17d8b5c44535de8595ab3f354d7"
        },
        "date": 1784130381761,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1336,
            "range": "±0.39%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 8.1185,
            "range": "±5.07%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.6174,
            "range": "±0.35%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 37.1168,
            "range": "±1.94%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 2.0198,
            "range": "±2.01%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 103.248,
            "range": "±2.02%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 8.2708,
            "range": "±5.49%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 5.6368,
            "range": "±4.42%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 33.1215,
            "range": "±2.72%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 25.9673,
            "range": "±1.34%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 94.4595,
            "range": "±3.04%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 100.7403,
            "range": "±11.74%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 349.7547,
            "range": "±0.67%",
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
          "id": "c78f1a787c6a0cb0e592da21d5ff741d0fb697f9",
          "message": "ci: publish pull request previews to pkg.pr.new and modernise dependency management (#137)",
          "timestamp": "2026-08-06T15:18:53+02:00",
          "tree_id": "c282063b00be15cd2799a5216bf13a3b166bc240",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/c78f1a787c6a0cb0e592da21d5ff741d0fb697f9"
        },
        "date": 1786022491241,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1461,
            "range": "±0.43%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 8.1382,
            "range": "±4.36%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.6745,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 40.3286,
            "range": "±6.05%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 2.1973,
            "range": "±1.78%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 105.1202,
            "range": "±1.62%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 8.5536,
            "range": "±3.93%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 6.4326,
            "range": "±6.69%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 33.5687,
            "range": "±3.29%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 27.1389,
            "range": "±4.68%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 101.2277,
            "range": "±2.52%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 79.2929,
            "range": "±2.61%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 321.6525,
            "range": "±0.19%",
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
          "id": "2f7ea8082132f946873fd595015bb7c7c24997dc",
          "message": "feat: accept multiple apex test classes in the mutation perimeter (#141)",
          "timestamp": "2026-08-07T10:04:40+02:00",
          "tree_id": "87f6a360fc540d73dc69b9da11a96acef6e557f2",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/2f7ea8082132f946873fd595015bb7c7c24997dc"
        },
        "date": 1786089996258,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1295,
            "range": "±0.56%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 8.3397,
            "range": "±4.17%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.5922,
            "range": "±0.51%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 40.8284,
            "range": "±6.57%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 1.9181,
            "range": "±1.86%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 105.4666,
            "range": "±2.88%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 8.3341,
            "range": "±4.47%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 6.2751,
            "range": "±5.61%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 35.0673,
            "range": "±3.71%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 28.0125,
            "range": "±5.28%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 99.985,
            "range": "±1.41%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 81.1372,
            "range": "±3.70%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 325.6346,
            "range": "±0.24%",
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
          "id": "b257c8b21bdcd79a69ec8df9ac427e58dfe4b434",
          "message": "feat: accept apex test suites as the mutation perimeter (#144)",
          "timestamp": "2026-08-07T14:11:32+02:00",
          "tree_id": "b281a4f3241c9655dc7b9318f93e00665e100a31",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/b257c8b21bdcd79a69ec8df9ac427e58dfe4b434"
        },
        "date": 1786104819076,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1195,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 7.4745,
            "range": "±4.22%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.5581,
            "range": "±0.51%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 38.2383,
            "range": "±7.29%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 1.802,
            "range": "±1.77%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 97.0596,
            "range": "±1.13%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 7.8973,
            "range": "±4.36%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 5.8693,
            "range": "±6.17%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 30.9473,
            "range": "±2.64%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 25.354,
            "range": "±5.40%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 92.1919,
            "range": "±1.29%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 75.2428,
            "range": "±2.77%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 305.6591,
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
          "id": "0c1f51a554c69f9e59448140f5dea424b0ef2371",
          "message": "fix: validate apex class names against the identifier grammar before any org call (#146)",
          "timestamp": "2026-08-07T16:13:56+02:00",
          "tree_id": "27134b96b4afc3b359c91936e55af0b8b06c3b82",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/0c1f51a554c69f9e59448140f5dea424b0ef2371"
        },
        "date": 1786112177620,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1242,
            "range": "±0.35%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 8.0189,
            "range": "±4.32%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.5827,
            "range": "±0.48%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 40.0337,
            "range": "±5.61%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 1.891,
            "range": "±2.04%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 100.7651,
            "range": "±1.41%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 8.0807,
            "range": "±4.01%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 6.6104,
            "range": "±8.25%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 35.3067,
            "range": "±4.73%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 26.6794,
            "range": "±3.45%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 98.5694,
            "range": "±1.94%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 80.2309,
            "range": "±3.52%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 320.0309,
            "range": "±0.76%",
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
          "id": "3f3a0d957354438de4194e1eee6f25482bed0f09",
          "message": "test: kill every killable mutant and document the equivalents (#147)",
          "timestamp": "2026-08-07T19:14:45+02:00",
          "tree_id": "bbbc099d3c8b217d1184d203bd331b3e5e722705",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/3f3a0d957354438de4194e1eee6f25482bed0f09"
        },
        "date": 1786123009776,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1285,
            "range": "±0.58%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 7.8372,
            "range": "±4.68%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.59,
            "range": "±0.54%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 39.326,
            "range": "±7.33%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 1.9148,
            "range": "±2.36%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 101.591,
            "range": "±1.82%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 7.8702,
            "range": "±4.70%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 6.1849,
            "range": "±6.57%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 31.4191,
            "range": "±2.17%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 25.6882,
            "range": "±4.54%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 94.5393,
            "range": "±2.25%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 76.2155,
            "range": "±3.02%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 317.9338,
            "range": "±4.25%",
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
          "id": "103c335bb2e5c35670c97a848a6630a6cf6b80ee",
          "message": "feat: skip unusable test classes with a reason instead of aborting the run (#148)",
          "timestamp": "2026-08-08T08:53:31+02:00",
          "tree_id": "e5c22053c39d8f02797b20680619d22a3e049de5",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/103c335bb2e5c35670c97a848a6630a6cf6b80ee"
        },
        "date": 1786172133841,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.0937,
            "range": "±0.37%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 5.5935,
            "range": "±3.57%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.4346,
            "range": "±0.36%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 28.4139,
            "range": "±6.92%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 1.4099,
            "range": "±1.62%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 74.1161,
            "range": "±0.89%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 5.8524,
            "range": "±3.68%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 4.8918,
            "range": "±7.00%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 25.152,
            "range": "±3.15%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 19.7569,
            "range": "±2.10%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 71.7979,
            "range": "±1.39%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 60.9784,
            "range": "±3.17%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 242.0085,
            "range": "±0.60%",
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
          "id": "2b737f3370d44c7e8fe7f10f1d1c14ee95ce7cde",
          "message": "feat: run single-class test payloads through the synchronous tooling resource (#150)",
          "timestamp": "2026-08-09T18:17:00+02:00",
          "tree_id": "70181048259c5b760519aff274c1f022a4f6d067",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/2b737f3370d44c7e8fe7f10f1d1c14ee95ce7cde"
        },
        "date": 1786292343086,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1401,
            "range": "±0.40%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 7.944,
            "range": "±4.13%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.6546,
            "range": "±0.57%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 39.2366,
            "range": "±8.00%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 2.1012,
            "range": "±2.12%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 104.0832,
            "range": "±2.83%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 8.2397,
            "range": "±4.26%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 6.2758,
            "range": "±5.43%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 33.597,
            "range": "±4.18%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 26.7589,
            "range": "±4.85%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 99.42,
            "range": "±1.81%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 79.0373,
            "range": "±2.79%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 321.0733,
            "range": "±0.23%",
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
          "id": "bd77dcdd004c42e0cf095e666b1a16ba3e5974b7",
          "message": "fix: roll back the mutated apex class when the mutation loop fails (#151)",
          "timestamp": "2026-08-09T21:14:24+02:00",
          "tree_id": "21f2460565698482142cf172c57f43c443659018",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/bd77dcdd004c42e0cf095e666b1a16ba3e5974b7"
        },
        "date": 1786302987596,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1289,
            "range": "±0.47%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 8.0475,
            "range": "±4.43%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.6003,
            "range": "±0.53%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 39.334,
            "range": "±7.06%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 2.0389,
            "range": "±3.49%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 102.1295,
            "range": "±1.61%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 8.2658,
            "range": "±3.80%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 6.2835,
            "range": "±5.76%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 33.5953,
            "range": "±3.74%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 26.9176,
            "range": "±5.28%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 98.9489,
            "range": "±2.32%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 83.7894,
            "range": "±6.61%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 329.785,
            "range": "±1.96%",
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
          "id": "f688817ec475e39860e07d0a2cb73a4fe75a85cb",
          "message": "refactor: decouple mutation orchestration from the org SDK behind ports (#153)",
          "timestamp": "2026-08-18T17:27:48+02:00",
          "tree_id": "fea35f987d1bef90b157cc61c34d63519bec2c83",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/f688817ec475e39860e07d0a2cb73a4fe75a85cb"
        },
        "date": 1787066980253,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1257,
            "range": "±0.88%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 7.7001,
            "range": "±4.57%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.5392,
            "range": "±0.42%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 37.4504,
            "range": "±8.25%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 1.7229,
            "range": "±1.74%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 96.1921,
            "range": "±1.12%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 7.7221,
            "range": "±4.68%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 5.8892,
            "range": "±5.79%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 30.4785,
            "range": "±1.97%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 26.7611,
            "range": "±10.47%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 97.5547,
            "range": "±6.09%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 75.5081,
            "range": "±1.04%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 315.6194,
            "range": "±3.77%",
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
          "id": "1192ff0f4b5fecb570a8dda7348979bfe0d487d5",
          "message": "chore: remove orphaned test fixtures and a stale vulnerability suppression (#154)",
          "timestamp": "2026-08-18T17:49:42+02:00",
          "tree_id": "8066cbb5b4db8f57a5efed8616232d76a9773ffd",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/1192ff0f4b5fecb570a8dda7348979bfe0d487d5"
        },
        "date": 1787068303168,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 0.1348,
            "range": "±0.47%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-small",
            "value": 8.1714,
            "range": "±4.28%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-medium",
            "value": 0.6217,
            "range": "±0.49%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-medium",
            "value": 40.0941,
            "range": "±5.87%",
            "unit": "ms"
          },
          {
            "name": "antlr-lex-large",
            "value": 2.0412,
            "range": "±2.51%",
            "unit": "ms"
          },
          {
            "name": "antlr-parse-large",
            "value": 103.9919,
            "range": "±2.02%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 8.4442,
            "range": "±4.39%",
            "unit": "ms"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 6.2654,
            "range": "±5.74%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 33.3928,
            "range": "±3.94%",
            "unit": "ms"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 27.042,
            "range": "±4.39%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 101.6764,
            "range": "±6.09%",
            "unit": "ms"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 78.9016,
            "range": "±3.05%",
            "unit": "ms"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 325.7432,
            "range": "±2.43%",
            "unit": "ms"
          }
        ]
      }
    ]
  }
}