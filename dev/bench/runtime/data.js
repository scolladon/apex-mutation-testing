window.BENCHMARK_DATA = {
  "lastUpdate": 1784130380310,
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
        "date": 1776509622513,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 7239,
            "range": "±0.65%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 117,
            "range": "±4.14%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1503,
            "range": "±1.43%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 25,
            "range": "±3.58%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 470,
            "range": "±1.32%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 9,
            "range": "±1.37%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 108,
            "range": "±5.52%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 153,
            "range": "±6.83%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 25,
            "range": "±4.70%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 34,
            "range": "±1.98%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 9,
            "range": "±3.58%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 11,
            "range": "±5.07%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±0.39%",
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
          "id": "2b04296513d2158b20149de4f9ece15991eedbab",
          "message": "feat: opt-in mutation grouping (DSATUR) to reduce deployments (#122)",
          "timestamp": "2026-05-05T17:07:23+02:00",
          "tree_id": "cae4e73e62833ee95d4d034b0afbcde1e388d379",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/2b04296513d2158b20149de4f9ece15991eedbab"
        },
        "date": 1777993872196,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 7564,
            "range": "±0.82%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 124,
            "range": "±4.05%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1605,
            "range": "±1.58%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 26,
            "range": "±1.32%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 501,
            "range": "±1.56%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 9,
            "range": "±2.45%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 111,
            "range": "±4.22%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 165,
            "range": "±4.26%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 28,
            "range": "±3.59%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 36,
            "range": "±1.87%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 10,
            "range": "±1.88%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 12,
            "range": "±0.95%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±0.56%",
            "unit": "ops/sec"
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
        "date": 1780318269558,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 6455,
            "range": "±0.78%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 123,
            "range": "±4.29%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1384,
            "range": "±0.96%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 26,
            "range": "±1.37%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 436,
            "range": "±1.35%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 9,
            "range": "±2.60%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 112,
            "range": "±4.66%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 167,
            "range": "±4.27%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 27,
            "range": "±3.88%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 35,
            "range": "±2.63%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 10,
            "range": "±1.35%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 12,
            "range": "±5.38%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±0.42%",
            "unit": "ops/sec"
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
        "date": 1784095580395,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 7821,
            "range": "±0.58%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 132,
            "range": "±4.05%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1690,
            "range": "±0.62%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 25,
            "range": "±7.06%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 523,
            "range": "±2.64%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 10,
            "range": "±1.04%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 124,
            "range": "±4.06%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 161,
            "range": "±5.83%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 31,
            "range": "±3.15%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 32,
            "range": "±7.06%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 11,
            "range": "±1.75%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 13,
            "range": "±3.06%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±0.36%",
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
          "id": "77828d88df121f57f62f40b4f5997d9683298727",
          "message": "chore: upgrade node engine floor to 22 with 22/24/26 support (#132)",
          "timestamp": "2026-07-15T13:04:53+02:00",
          "tree_id": "3979e68b0f917f505c5adb44d4233a3191689c13",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/77828d88df121f57f62f40b4f5997d9683298727"
        },
        "date": 1784113639571,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 7189,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 127,
            "range": "±4.51%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1546,
            "range": "±0.33%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 27,
            "range": "±4.14%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 471,
            "range": "±1.81%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 10,
            "range": "±0.38%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 126,
            "range": "±5.09%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 167,
            "range": "±6.93%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 30,
            "range": "±1.96%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 38,
            "range": "±2.35%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 10,
            "range": "±2.68%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 13,
            "range": "±1.72%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±1.25%",
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
          "id": "99947d47ee86c40d2e9dc25fa256f278dbcc8e44",
          "message": "fix: allowlist re2 install script for npm 12 (#133)",
          "timestamp": "2026-07-15T15:28:23+02:00",
          "tree_id": "a9ab1d4a4e94ad522b7f5f54472a6babd20f415e",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/99947d47ee86c40d2e9dc25fa256f278dbcc8e44"
        },
        "date": 1784122223998,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 7432,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 123,
            "range": "±5.01%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1595,
            "range": "±0.52%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 27,
            "range": "±2.10%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 489,
            "range": "±2.14%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 10,
            "range": "±0.85%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 100,
            "range": "±7.17%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 172,
            "range": "±5.05%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 30,
            "range": "±3.20%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 37,
            "range": "±3.33%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 10,
            "range": "±3.06%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 12,
            "range": "±3.29%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±0.20%",
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
          "id": "fadb73c394a9b17d8b5c44535de8595ab3f354d7",
          "message": "fix: replace re2 with re2js to eliminate npm 12 install-script friction (#135)",
          "timestamp": "2026-07-15T17:44:15+02:00",
          "tree_id": "5b18f8b07034216f23046fad20e56cbb59c90f95",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/fadb73c394a9b17d8b5c44535de8595ab3f354d7"
        },
        "date": 1784130379631,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 7484,
            "range": "±0.39%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 123,
            "range": "±5.07%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1620,
            "range": "±0.35%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 27,
            "range": "±1.94%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 495,
            "range": "±2.01%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 10,
            "range": "±2.02%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 121,
            "range": "±5.49%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 177,
            "range": "±4.42%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 30,
            "range": "±2.72%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 39,
            "range": "±1.34%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 11,
            "range": "±3.04%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 10,
            "range": "±11.74%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±0.67%",
            "unit": "ops/sec"
          }
        ]
      }
    ]
  }
}