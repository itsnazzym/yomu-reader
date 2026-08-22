import React from "react";
import { Feather } from "@expo/vector-icons";

type FeatherProps = React.ComponentProps<typeof Feather>;
type IconProps = Omit<FeatherProps, "name"> & {
  name?: FeatherProps["name"];
  /** Compatibility with the former Tabler icon API. */
  stroke?: number;
  strokeWidth?: number;
  fill?: string;
};

type IconComponent = React.ComponentType<IconProps>;

function makeFeatherIcon(name: FeatherProps["name"]): IconComponent {
  const Icon = React.forwardRef<any, IconProps>(
    ({ stroke: _stroke, strokeWidth: _strokeWidth, fill: _fill, ...props }, ref) => (
      <Feather ref={ref} name={name} {...props} />
    )
  );
  Icon.displayName = `Compat${String(name)}Icon`;
  return Icon;
}

// The app used Tabler names, while Expo's bundled icon font is the reliable
// native implementation for this Expo SDK. Keep the public names stable so
// screens and animations do not need platform-specific branches.
export const IconAdjustmentsHorizontal = makeFeatherIcon("sliders");
export const IconAlertCircle = makeFeatherIcon("alert-circle");
export const IconAlertTriangle = makeFeatherIcon("alert-triangle");
export const IconArrowLeft = makeFeatherIcon("arrow-left");
export const IconArrowRight = makeFeatherIcon("arrow-right");
export const IconArrowsShuffle = makeFeatherIcon("shuffle");
export const IconBan = makeFeatherIcon("slash");
export const IconBolt = makeFeatherIcon("zap");
export const IconBook2 = makeFeatherIcon("book-open");
export const IconBookmark = makeFeatherIcon("bookmark");
export const IconBox = makeFeatherIcon("box");
export const IconBrandDiscord = makeFeatherIcon("message-circle");
export const IconCalendar = makeFeatherIcon("calendar");
export const IconCheck = makeFeatherIcon("check");
export const IconChevronDown = makeFeatherIcon("chevron-down");
export const IconChevronLeft = makeFeatherIcon("chevron-left");
export const IconChevronRight = makeFeatherIcon("chevron-right");
export const IconChevronUp = makeFeatherIcon("chevron-up");
export const IconCircleArrowLeft = makeFeatherIcon("arrow-left-circle");
export const IconCircleArrowRight = makeFeatherIcon("arrow-right-circle");
export const IconCircleCheck = makeFeatherIcon("check-circle");
export const IconClipboard = makeFeatherIcon("copy");
export const IconClock = makeFeatherIcon("clock");
export const IconColumns = makeFeatherIcon("grid");
export const IconCloud = makeFeatherIcon("cloud");
export const IconCloudDownload = makeFeatherIcon("download-cloud");
export const IconCompass = makeFeatherIcon("compass");
export const IconCopy = makeFeatherIcon("copy");
export const IconCpu = makeFeatherIcon("cpu");
export const IconDatabase = makeFeatherIcon("database");
export const IconDeviceTv = makeFeatherIcon("tv");
export const IconDevices = makeFeatherIcon("monitor");
export const IconDeviceFloppy = makeFeatherIcon("save");
export const IconDownload = makeFeatherIcon("download");
export const IconDroplet = makeFeatherIcon("droplet");
export const IconExternalLink = makeFeatherIcon("external-link");
export const IconEye = makeFeatherIcon("eye");
export const IconEyeOff = makeFeatherIcon("eye-off");
export const IconFeather = makeFeatherIcon("feather");
export const IconFileText = makeFeatherIcon("file-text");
export const IconFlame = makeFeatherIcon("zap");
export const IconFolder = makeFeatherIcon("folder");
export const IconHeart = makeFeatherIcon("heart");
export const IconHelpCircle = makeFeatherIcon("help-circle");
export const IconInbox = makeFeatherIcon("inbox");
export const IconInfoCircle = makeFeatherIcon("info");
export const IconKey = makeFeatherIcon("key");
export const IconLayoutList = makeFeatherIcon("list");
export const IconLock = makeFeatherIcon("lock");
export const IconLogin = makeFeatherIcon("log-in");
export const IconLogout = makeFeatherIcon("log-out");
export const IconMail = makeFeatherIcon("mail");
export const IconMenu2 = makeFeatherIcon("menu");
export const IconMessageCircle = makeFeatherIcon("message-circle");
export const IconPalette = makeFeatherIcon("droplet");
export const IconPhoto = makeFeatherIcon("image");
export const IconPhotoSearch = makeFeatherIcon("camera");
export const IconPlayerPause = makeFeatherIcon("pause-circle");
export const IconPlayerPlay = makeFeatherIcon("play-circle");
export const IconPlus = makeFeatherIcon("plus");
export const IconMinus = makeFeatherIcon("minus");
export const IconQrcode = makeFeatherIcon("grid");
export const IconRefresh = makeFeatherIcon("refresh-cw");
export const IconReload = makeFeatherIcon("refresh-cw");
export const IconRotate = makeFeatherIcon("rotate-cw");
export const IconRotateCcw = makeFeatherIcon("rotate-ccw");
export const IconRotateClockwise = makeFeatherIcon("rotate-cw");
export const IconSearch = makeFeatherIcon("search");
export const IconSearchOff = makeFeatherIcon("slash");
export const IconSettings = makeFeatherIcon("settings");
export const IconShare = makeFeatherIcon("share");
export const IconShield = makeFeatherIcon("shield");
export const IconShieldCheck = makeFeatherIcon("check-circle");
export const IconSparkles = makeFeatherIcon("star");
export const IconStar = makeFeatherIcon("star");
export const IconTag = makeFeatherIcon("tag");
export const IconTags = makeFeatherIcon("tag");
export const IconTrash = makeFeatherIcon("trash-2");
export const IconUpload = makeFeatherIcon("upload");
export const IconUser = makeFeatherIcon("user");
export const IconUserCheck = makeFeatherIcon("user-check");
export const IconUserPlus = makeFeatherIcon("user-plus");
export const IconUsers = makeFeatherIcon("users");
export const IconWifiOff = makeFeatherIcon("wifi-off");
export const IconWorld = makeFeatherIcon("globe");
export const IconZoomIn = makeFeatherIcon("zoom-in");
export const IconZoomOut = makeFeatherIcon("zoom-out");
export const IconMove = makeFeatherIcon("move");
export const IconX = makeFeatherIcon("x");
