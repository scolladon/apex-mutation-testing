#!/bin/bash

DEV_TAG=$1
OTP=$2
PACKAGE="apex-mutation-testing"

npm view "${PACKAGE}" versions --json | jq -r '.[]' | grep "\\-${DEV_TAG}\\." | xargs -I {} npm deprecate "${PACKAGE}@{}" "Deprecated dev version" --otp "${OTP}"
npm dist-tag rm "${PACKAGE}" "${DEV_TAG}" --otp "${OTP}"