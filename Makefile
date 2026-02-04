# Makefile for building and packaging the VS Code extension

.PHONY: help install build package release clean

# Default target
help:
	@echo "Available targets:"
	@echo "  install  - Install npm dependencies"
	@echo "  build    - Compile TypeScript and bundle with webpack"
	@echo "  package  - Create VSIX package file"
	@echo "  release  - Build and create release output (VSIX in release/)"
	@echo "  clean    - Remove build artifacts and release files"

# Install dependencies
install:
	npm install

# Build the extension (compile and bundle)
build:
	npm run package

# Package the extension into a VSIX file
package: build
	npx vsce package

# Create release output with VSIX file
release: package
	@echo "Creating release output..."
	@mkdir -p release
	@if ls *.vsix 1> /dev/null 2>&1; then \
		cp *.vsix release/; \
		echo "Release files copied to release/ directory"; \
		ls -lh release/; \
	else \
		echo "Error: No VSIX file found. Run 'make package' first."; \
		exit 1; \
	fi

# Clean build artifacts (preserves node_modules for faster rebuilds)
# Use 'rm -rf node_modules' separately for a complete clean
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist out node_modules/.cache
	@rm -f *.vsix
	@rm -rf release
	@echo "Clean complete"
