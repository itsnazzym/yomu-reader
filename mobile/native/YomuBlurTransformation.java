package expo.modules.image;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import com.bumptech.glide.load.engine.bitmap_recycle.BitmapPool;
import com.bumptech.glide.load.resource.bitmap.BitmapTransformation;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import jp.wasabeef.glide.transformations.internal.FastBlur;

/** Software blur avoids RenderScript's shared-context lifetime across Glide workers. */
public final class YomuBlurTransformation extends BitmapTransformation {
  private static final byte[] ID = "yomu.image.software-blur.v1".getBytes(StandardCharsets.UTF_8);
  private final int radius;
  private final int sampling;

  public YomuBlurTransformation(int radius, int sampling) {
    this.radius = Math.max(1, Math.min(radius, 25));
    this.sampling = Math.max(1, sampling);
  }

  @Override
  protected Bitmap transform(BitmapPool pool, Bitmap input, int outWidth, int outHeight) {
    int width = Math.max(1, input.getWidth() / sampling);
    int height = Math.max(1, input.getHeight() / sampling);
    Bitmap output = pool.get(width, height, Bitmap.Config.ARGB_8888);
    output.setHasAlpha(input.hasAlpha());
    Canvas canvas = new Canvas(output);
    canvas.scale(1f / sampling, 1f / sampling);
    canvas.drawBitmap(input, 0, 0, new Paint(Paint.FILTER_BITMAP_FLAG | Paint.DITHER_FLAG));
    return FastBlur.blur(output, radius, true);
  }

  @Override
  public boolean equals(Object other) {
    if (!(other instanceof YomuBlurTransformation)) return false;
    YomuBlurTransformation blur = (YomuBlurTransformation) other;
    return radius == blur.radius && sampling == blur.sampling;
  }

  @Override
  public int hashCode() { return 31 * (31 * getClass().getName().hashCode() + radius) + sampling; }

  @Override
  public void updateDiskCacheKey(MessageDigest digest) {
    digest.update(ID);
    digest.update(ByteBuffer.allocate(8).putInt(radius).putInt(sampling).array());
  }
}
