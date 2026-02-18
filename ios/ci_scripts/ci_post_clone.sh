#!/bin/sh
set -e

# 1. Move to the project root (up two levels from ios/ci_scripts)
cd ../..

# 2. Install Node and CocoaPods
brew install node cocoapods

# 3. Install your JS dependencies
npm install

# 4. Install the iOS specific pods
cd ios
pod install
