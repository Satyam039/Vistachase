import Image from "next/image";

export function BrandMark({ size = 38, variant = "default" }: { size?: number; variant?: "default" | "white" | "emblem" }) {
  if (variant === "white") {
    return (
      <div className="relative flex items-center gap-2.5">
        <Image
          src="https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/6906ed2d407b21d560ca0dd0_images%204.png"
          alt="Vista Chase Luxury Canadian Rockies Tours"
          width={size * 3.4}
          height={size}
          className="object-contain h-9 w-auto"
          priority
        />
      </div>
    );
  }

  if (variant === "emblem") {
    return (
      <div className="relative flex items-center justify-center">
        <Image
          src="https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/6907ce5d58aa3223085833b6_4a63d88a7f5330f9765fc90768f76f2c323f34d3.png"
          alt="Vista Chase Horse Emblem"
          width={size}
          height={size}
          className="object-contain"
          priority
        />
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2.5">
      <Image
        src="https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/69089376e89919ea16ef4b89_images%204%20(1).png"
        alt="Vista Chase Luxury Tours & Shuttles"
        width={size * 3.4}
        height={size}
        className="object-contain h-9 w-auto"
        priority
      />
    </div>
  );
}
