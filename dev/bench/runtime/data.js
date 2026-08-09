window.BENCHMARK_DATA = {
  "lastUpdate": 1786302986192,
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
        "date": 1786022489087,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 6844,
            "range": "±0.43%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 123,
            "range": "±4.36%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1483,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 25,
            "range": "±6.05%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 455,
            "range": "±1.78%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 10,
            "range": "±1.62%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 117,
            "range": "±3.93%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 155,
            "range": "±6.69%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 30,
            "range": "±3.29%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 37,
            "range": "±4.68%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 10,
            "range": "±2.52%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 13,
            "range": "±2.61%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±0.19%",
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
          "id": "2f7ea8082132f946873fd595015bb7c7c24997dc",
          "message": "feat: accept multiple apex test classes in the mutation perimeter (#141)",
          "timestamp": "2026-08-07T10:04:40+02:00",
          "tree_id": "87f6a360fc540d73dc69b9da11a96acef6e557f2",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/2f7ea8082132f946873fd595015bb7c7c24997dc"
        },
        "date": 1786089994204,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 7723,
            "range": "±0.56%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 120,
            "range": "±4.17%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1689,
            "range": "±0.51%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 24,
            "range": "±6.57%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 521,
            "range": "±1.86%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 9,
            "range": "±2.88%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 120,
            "range": "±4.47%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 159,
            "range": "±5.61%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 29,
            "range": "±3.71%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 36,
            "range": "±5.28%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 10,
            "range": "±1.41%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 12,
            "range": "±3.70%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±0.24%",
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
          "id": "b257c8b21bdcd79a69ec8df9ac427e58dfe4b434",
          "message": "feat: accept apex test suites as the mutation perimeter (#144)",
          "timestamp": "2026-08-07T14:11:32+02:00",
          "tree_id": "b281a4f3241c9655dc7b9318f93e00665e100a31",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/b257c8b21bdcd79a69ec8df9ac427e58dfe4b434"
        },
        "date": 1786104817506,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 8371,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 134,
            "range": "±4.22%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1792,
            "range": "±0.51%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 26,
            "range": "±7.29%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 555,
            "range": "±1.77%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 10,
            "range": "±1.13%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 127,
            "range": "±4.36%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 170,
            "range": "±6.17%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 32,
            "range": "±2.64%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 39,
            "range": "±5.40%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 11,
            "range": "±1.29%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 13,
            "range": "±2.77%",
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
          "id": "0c1f51a554c69f9e59448140f5dea424b0ef2371",
          "message": "fix: validate apex class names against the identifier grammar before any org call (#146)",
          "timestamp": "2026-08-07T16:13:56+02:00",
          "tree_id": "27134b96b4afc3b359c91936e55af0b8b06c3b82",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/0c1f51a554c69f9e59448140f5dea424b0ef2371"
        },
        "date": 1786112174183,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 8049,
            "range": "±0.35%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 125,
            "range": "±4.32%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1716,
            "range": "±0.48%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 25,
            "range": "±5.61%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 529,
            "range": "±2.04%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 10,
            "range": "±1.41%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 124,
            "range": "±4.01%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 151,
            "range": "±8.25%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 28,
            "range": "±4.73%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 37,
            "range": "±3.45%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 10,
            "range": "±1.94%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 12,
            "range": "±3.52%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±0.76%",
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
          "id": "3f3a0d957354438de4194e1eee6f25482bed0f09",
          "message": "test: kill every killable mutant and document the equivalents (#147)",
          "timestamp": "2026-08-07T19:14:45+02:00",
          "tree_id": "bbbc099d3c8b217d1184d203bd331b3e5e722705",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/3f3a0d957354438de4194e1eee6f25482bed0f09"
        },
        "date": 1786123008091,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 7780,
            "range": "±0.58%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 128,
            "range": "±4.68%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1695,
            "range": "±0.54%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 25,
            "range": "±7.33%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 522,
            "range": "±2.36%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 10,
            "range": "±1.82%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 127,
            "range": "±4.70%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 162,
            "range": "±6.57%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 32,
            "range": "±2.17%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 39,
            "range": "±4.54%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 11,
            "range": "±2.25%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 13,
            "range": "±3.02%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±4.25%",
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
          "id": "103c335bb2e5c35670c97a848a6630a6cf6b80ee",
          "message": "feat: skip unusable test classes with a reason instead of aborting the run (#148)",
          "timestamp": "2026-08-08T08:53:31+02:00",
          "tree_id": "e5c22053c39d8f02797b20680619d22a3e049de5",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/103c335bb2e5c35670c97a848a6630a6cf6b80ee"
        },
        "date": 1786172131916,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 10672,
            "range": "±0.37%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 179,
            "range": "±3.57%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 2301,
            "range": "±0.36%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 35,
            "range": "±6.92%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 709,
            "range": "±1.62%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 13,
            "range": "±0.89%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 171,
            "range": "±3.68%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 204,
            "range": "±7.00%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 40,
            "range": "±3.15%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 51,
            "range": "±2.10%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 14,
            "range": "±1.39%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 16,
            "range": "±3.17%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 4,
            "range": "±0.60%",
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
          "id": "2b737f3370d44c7e8fe7f10f1d1c14ee95ce7cde",
          "message": "feat: run single-class test payloads through the synchronous tooling resource (#150)",
          "timestamp": "2026-08-09T18:17:00+02:00",
          "tree_id": "70181048259c5b760519aff274c1f022a4f6d067",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/2b737f3370d44c7e8fe7f10f1d1c14ee95ce7cde"
        },
        "date": 1786292340988,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 7138,
            "range": "±0.40%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 126,
            "range": "±4.13%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1528,
            "range": "±0.57%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-medium",
            "value": 25,
            "range": "±8.00%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-large",
            "value": 476,
            "range": "±2.12%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 10,
            "range": "±2.83%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 121,
            "range": "±4.26%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 159,
            "range": "±5.43%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 30,
            "range": "±4.18%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 37,
            "range": "±4.85%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 10,
            "range": "±1.81%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 13,
            "range": "±2.79%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±0.23%",
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
          "id": "bd77dcdd004c42e0cf095e666b1a16ba3e5974b7",
          "message": "fix: roll back the mutated apex class when the mutation loop fails (#151)",
          "timestamp": "2026-08-09T21:14:24+02:00",
          "tree_id": "21f2460565698482142cf172c57f43c443659018",
          "url": "https://github.com/scolladon/apex-mutation-testing/commit/bd77dcdd004c42e0cf095e666b1a16ba3e5974b7"
        },
        "date": 1786302985624,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "antlr-lex-small",
            "value": 7760,
            "range": "±0.47%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-small",
            "value": 124,
            "range": "±4.43%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-lex-medium",
            "value": 1666,
            "range": "±0.53%",
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
            "value": 490,
            "range": "±3.49%",
            "unit": "ops/sec"
          },
          {
            "name": "antlr-parse-large",
            "value": 10,
            "range": "±1.61%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-compute-mutations",
            "value": 121,
            "range": "±3.80%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-small-type-discovery",
            "value": 159,
            "range": "±5.76%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-compute-mutations",
            "value": 30,
            "range": "±3.74%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-medium-type-discovery",
            "value": 37,
            "range": "±5.28%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-compute-mutations",
            "value": 10,
            "range": "±2.32%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-large-type-discovery",
            "value": 12,
            "range": "±6.61%",
            "unit": "ops/sec"
          },
          {
            "name": "pipeline-apply-all-mutations",
            "value": 3,
            "range": "±1.96%",
            "unit": "ops/sec"
          }
        ]
      }
    ]
  }
}