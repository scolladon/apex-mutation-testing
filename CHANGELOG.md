# Changelog

## [1.3.0](https://github.com/scolladon/apex-mutation-testing/compare/v1.2.0...v1.3.0) (2026-02-14)


### Features

* add experimental switch mutator ([#73](https://github.com/scolladon/apex-mutation-testing/issues/73)) ([d7fe14e](https://github.com/scolladon/apex-mutation-testing/commit/d7fe14e65a6a30098b652f3b0a986a19fd69fbdc))


### Bug Fixes

* mark compile errors ([#72](https://github.com/scolladon/apex-mutation-testing/issues/72)) ([eec6d4d](https://github.com/scolladon/apex-mutation-testing/commit/eec6d4d535f3f8ffcb2118af21c249bf922ee6cb))
* **negation:** type-aware NegationMutator with double negation prevention ([#82](https://github.com/scolladon/apex-mutation-testing/issues/82)) ([d851ba7](https://github.com/scolladon/apex-mutation-testing/commit/d851ba71e464a64831d20e8e25c87a70ea3a4126))
* type-aware ArithmeticOperatorMutator to suppress string concatenation mutations ([#84](https://github.com/scolladon/apex-mutation-testing/issues/84)) ([fe7de7e](https://github.com/scolladon/apex-mutation-testing/commit/fe7de7e536957f17a36c63950127dd0f150fccb9))

## [1.2.0](https://github.com/scolladon/apex-mutation-testing/compare/v1.1.0...v1.2.0) (2026-02-03)


### Features

* add arithmetic operator + test ([85ab90c](https://github.com/scolladon/apex-mutation-testing/commit/85ab90cb9d2a6b2252d8b9a32e7b88b7c87c147c))
* add arithmetic operator + test ([e9f8de2](https://github.com/scolladon/apex-mutation-testing/commit/e9f8de298b451cc4f70bfff2791781012a6f4031))
* add constructor call mutator ([#65](https://github.com/scolladon/apex-mutation-testing/issues/65)) ([aaecf1f](https://github.com/scolladon/apex-mutation-testing/commit/aaecf1ff986b5709967bbdf5894a8195e90ab299))
* add invert negatives mutator ([#60](https://github.com/scolladon/apex-mutation-testing/issues/60)) ([6268ede](https://github.com/scolladon/apex-mutation-testing/commit/6268ede244d144ccf58a4cbb03224747eb079a8a))
* add Logical Operator Mutator ([#59](https://github.com/scolladon/apex-mutation-testing/issues/59)) ([7f81a80](https://github.com/scolladon/apex-mutation-testing/commit/7f81a80a23f21c8326f351b6304c34cea599615d))
* add negation mutator ([#61](https://github.com/scolladon/apex-mutation-testing/issues/61)) ([5de9a50](https://github.com/scolladon/apex-mutation-testing/commit/5de9a50942b0119c68874c82ee359c5cc763ee89))
* add remove conditionals mutator ([#66](https://github.com/scolladon/apex-mutation-testing/issues/66)) ([bf36df6](https://github.com/scolladon/apex-mutation-testing/commit/bf36df69ce47870b2d78e00f272aa4d8ae50a0fb))
* add remove increments mutator ([#62](https://github.com/scolladon/apex-mutation-testing/issues/62)) ([903778c](https://github.com/scolladon/apex-mutation-testing/commit/903778c95aa88bf633c89e5101772869fd564e86))
* add switch mutator ([#67](https://github.com/scolladon/apex-mutation-testing/issues/67)) ([6763227](https://github.com/scolladon/apex-mutation-testing/commit/67632273e854b257738e7b71ed99faa766359fef))
* add void method call mutator ([#64](https://github.com/scolladon/apex-mutation-testing/issues/64)) ([12c3d5b](https://github.com/scolladon/apex-mutation-testing/commit/12c3d5bee0ed17993d1d42335098bf2b8ffb0d2e))
* compute test methods per line ([#55](https://github.com/scolladon/apex-mutation-testing/issues/55)) ([f44f890](https://github.com/scolladon/apex-mutation-testing/commit/f44f89042569e0c18285869faef04d7ed8bd4843))
* return type aware mutators ([#50](https://github.com/scolladon/apex-mutation-testing/issues/50)) ([6657c22](https://github.com/scolladon/apex-mutation-testing/commit/6657c22b76aa7dd8699faaec727650d97bc76ea9))


### Bug Fixes

* add helpful error messages when zero mutations are generated ([#58](https://github.com/scolladon/apex-mutation-testing/issues/58)) ([18110ee](https://github.com/scolladon/apex-mutation-testing/commit/18110ee41475ed30886609028355c63f64d8bb87))
* ci build and dependencies ([#52](https://github.com/scolladon/apex-mutation-testing/issues/52)) ([c0af3dc](https://github.com/scolladon/apex-mutation-testing/commit/c0af3dce3bb981bb5be941e05c15894bae9564e6))
* poll for deployment completion before running tests ([#57](https://github.com/scolladon/apex-mutation-testing/issues/57)) ([8e19996](https://github.com/scolladon/apex-mutation-testing/commit/8e199960c7905d678eea07c53055f3d9cf783d1c))

## [1.1.0](https://github.com/scolladon/apex-mutation-testing/compare/v1.0.0...v1.1.0) (2025-03-02)


### Features

* generate mutation only for covered lines ([#15](https://github.com/scolladon/apex-mutation-testing/issues/15)) ([e726e57](https://github.com/scolladon/apex-mutation-testing/commit/e726e57571d4cd84db82eae6b150a85d77ecb0f0))

## 1.0.0 (2025-02-27)


### Features

* implement first mutant generators ([#6](https://github.com/scolladon/apex-mutation-testing/issues/6)) ([3309f64](https://github.com/scolladon/apex-mutation-testing/commit/3309f6415272975534d194f04e8e7b666335b338))
