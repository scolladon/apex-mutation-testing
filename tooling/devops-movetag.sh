#!/bin/bash

VERSION=$1
TAG=$2
OTP=$3
PACKAGE="apex-mutation-testing"

npm dist-tag add "${PACKAGE}@${VERSION}" "${TAG}" --otp "${OTP}"