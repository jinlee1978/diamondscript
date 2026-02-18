#!/bin/sh
set -e

# 1. Move to the 'ios' folder where your .xcodeproj lives
cd ..

# 2. Update the build number (agvtool will now find the project)
agvtool new-version -all $CI_BUILD_NUMBER

# 3. Now move to the project root for npm/pods
cd ..
brew install node cocoapods
npm install
cd ios && pod install