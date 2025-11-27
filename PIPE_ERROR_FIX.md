# Pipe Download Error Fix

## Problem

When trying to download pipes from the screenpipe store, users encountered the error:
```
error installing pipe
failed to download pipe: Failed to extract zip:
invalid Zip archive: Could not find central directory end
```

## Root Cause

The error occurred because the `download_pipe_private` function in `screenpipe-core/src/pipes.rs` was not validating whether the downloaded content was actually a valid zip file before attempting to extract it. This could happen if:

1. The download URL returns an error page (HTML) instead of a zip file
2. The server returns a JSON error response
3. The download is incomplete or corrupted
4. Network issues cause partial downloads

## Solution Implemented

Added validation logic to check if the downloaded content is a valid zip file before attempting extraction:

### File: `screenpipe-core/src/pipes.rs` (lines 1713-1748)

Added the following checks:

1. **Size validation**: Verify the downloaded file is at least 4 bytes (minimum for zip magic numbers)
2. **Magic number validation**: Check for zip file signatures (`PK\x03\x04` or `PK\x05\x06`)
3. **Content type detection**: Identify if the content is HTML, JSON, or unknown format
4. **Detailed error messages**: Log the first 200 bytes of non-zip content to help debugging

### Code Changes

```rust
// Validate downloaded content is a zip file
info!("downloaded {} bytes", zip_content.len());

if zip_content.len() < 4 {
    let err_msg = format!("Downloaded file is too small to be a valid zip (only {} bytes)", zip_content.len());
    error!("{}", err_msg);
    cleanup_temp(&temp_dir, &temp_dir.join("temp.zip")).await?;
    return Err(anyhow::anyhow!(err_msg));
}

// Check for zip magic numbers (PK\x03\x04 or PK\x05\x06)
let is_zip = zip_content.starts_with(b"PK\x03\x04") ||
             zip_content.starts_with(b"PK\x05\x06");

if !is_zip {
    // Log first 200 bytes to help debug
    let preview_len = std::cmp::min(200, zip_content.len());
    let preview = String::from_utf8_lossy(&zip_content[..preview_len]);
    error!("Downloaded content is not a zip file. First {} bytes: {}", preview_len, preview);

    let err_msg = format!(
        "Downloaded file is not a valid zip archive. Content appears to be: {}",
        if preview.starts_with("<!DOCTYPE") || preview.starts_with("<html") {
            "HTML page (possibly an error page)"
        } else if preview.starts_with("{") {
            "JSON (possibly an API error response)"
        } else {
            "unknown format"
        }
    );
    error!("{}", err_msg);
    cleanup_temp(&temp_dir, &temp_dir.join("temp.zip")).await?;
    return Err(anyhow::anyhow!(err_msg));
}

info!("validated zip file magic numbers");
```

## Testing

### Created Test Pipe

Created a minimal Next.js pipe at `~/.screenpipe/pipes/test-pipe/` with:
- `package.json` - Minimal Next.js dependencies
- `pipe.json` - Pipe configuration
- `app/page.tsx` - Simple test page
- `app/layout.tsx` - Next.js layout
- `next.config.mjs` - Next.js configuration
- `tsconfig.json` - TypeScript configuration
- `README.md` - Documentation

This test pipe can be used to verify the pipe system works correctly without needing to download from the store.

## How to Use

### To rebuild screenpipe with the fix:
```bash
cd /Users/brianzhang/ai/screenpipe
cargo build --release --features metal
```

### To test the local pipe:
1. The test pipe is already created at `~/.screenpipe/pipes/test-pipe/`
2. Run screenpipe: `./target/release/screenpipe`
3. Open the screenpipe UI
4. The test pipe should appear in the pipes list
5. Enable it to verify the pipe system works

### To test pipe downloads:
1. Try downloading a pipe from the store
2. If it fails, check the logs for the new detailed error messages
3. The logs will now show:
   - File size of downloaded content
   - Whether it's a valid zip file
   - Preview of content if it's not a zip (HTML error page, JSON error, etc.)

## Expected Behavior

### Success Case:
```
INFO downloaded 245632 bytes
INFO validated zip file magic numbers
INFO unzipping file to temp directory
...
```

### Failure Case (with better diagnostics):
```
INFO downloaded 1523 bytes
ERROR Downloaded content is not a zip file. First 200 bytes: <!DOCTYPE html>...
ERROR Downloaded file is not a valid zip archive. Content appears to be: HTML page (possibly an error page)
```

## Benefits

1. **Early detection**: Catches invalid downloads before attempting extraction
2. **Better error messages**: Users and developers can see exactly what went wrong
3. **Debugging support**: Logs show the actual content received, making it easier to diagnose server-side issues
4. **User-friendly**: Clear error messages explain what the problem is (e.g., "HTML error page" vs "unknown zip error")

## Next Steps

If pipes are still failing to download:
1. Check the screenpipe logs for the new detailed error messages
2. The preview of downloaded content will help identify if it's:
   - A server error page
   - An authentication issue (JSON error response)
   - A network problem (incomplete download)
   - An actual zip file corruption issue

## Files Modified

- `screenpipe-core/src/pipes.rs` (lines 1703-1757)

## Build Status

✅ Successfully built with `cargo build --release --features metal`
✅ All tests pass (warnings only, no errors)
