#!/bin/sh
set -e

# 1. Move to project root
cd ../..

# 2. Automate the build number using the Xcode Cloud Environment Variable
# This ensures the version in the cloud matches the Build Number Apple expects
agvtool new-version -all $CI_BUILD_NUMBER

# 3. Standard setup
brew install node cocoapods
npm install
cd ios && pod install