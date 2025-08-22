#!/bin/bash

# Extension Reload Helper Script
# This script helps reload the Chrome extension during development

echo "🔄 Chrome Extension Reload Helper"
echo "=================================="
echo ""
echo "📋 Steps to reload the extension:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Find 'Sumo Bug Logger' extension"
echo "3. Click the reload button (🔄) on the extension card"
echo "4. Or disable and re-enable the extension"
echo ""
echo "🎯 Test the extension on: http://localhost:8080/component-test.html"
echo ""
echo "🐛 If component selection still doesn't work:"
echo "   - Check Chrome DevTools Console for errors"
echo "   - Verify the extension has the required permissions"
echo "   - Make sure you're on the correct URL (localhost:8080)"
echo ""
echo "✅ Expected behavior:"
echo "   - Click 'Select Buggy Component' button"
echo "   - Hover over colored components to see red outlines"
echo "   - See tooltips with component name and team info"
echo "   - Click on a component to select it"
