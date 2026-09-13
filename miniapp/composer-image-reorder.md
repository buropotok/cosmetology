# Composer photo reordering

Photo order is owned by `composer-image-manager.js`. Each thumbnail exposes a dedicated drag handle. Pointer input (mouse, pen, or touch) selects a destination thumbnail; on release the manager moves the corresponding `File` in its owned `files` array and runs the normal input synchronization/change path. Telegram slideshow/collage publishing therefore consumes the reordered file sequence rather than a DOM-derived order.
