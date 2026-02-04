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
	@cp *.vsix release/ 2>/dev/null || true
	@echo "Release files copied to release/ directory"
	@ls -lh release/

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist out node_modules/.cache
	@rm -f *.vsix
	@rm -rf release
	@echo "Clean complete"
