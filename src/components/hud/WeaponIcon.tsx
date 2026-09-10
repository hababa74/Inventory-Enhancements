import type { WeaponId } from "../../game/constants";
import shotgunAsset from "../../assets/weapons/shotgun.png.asset.json";
import tacshotgunAsset from "../../assets/weapons/tacshotgun.png.asset.json";
import rifleAsset from "../../assets/weapons/rifle.png.asset.json";
import smgAsset from "../../assets/weapons/smg.png.asset.json";
import sniperAsset from "../../assets/weapons/sniper.png.asset.json";
import pistolAsset from "../../assets/weapons/pistol.png.asset.json";
import rocketAsset from "../../assets/weapons/rocket.png.asset.json";
import pickaxeAsset from "../../assets/weapons/pickaxe.png.asset.json";

const ART: Record<WeaponId, string> = {
  shotgun: shotgunAsset.url,
  tacshotgun: tacshotgunAsset.url,
  rifle: rifleAsset.url,
  smg: smgAsset.url,
  sniper: sniperAsset.url,
  pistol: pistolAsset.url,
  rocket: rocketAsset.url,
  pickaxe: pickaxeAsset.url,
};

/** Rendered weapon art so every slot is recognisable at a glance. */
export function WeaponIcon({
  id,
  color,
  className = "",
}: {
  id: WeaponId;
  color?: string;
  className?: string;
}) {
  return (
    <img
      src={ART[id]}
      alt={id}
      loading="lazy"
      width={768}
      height={512}
      className={`object-contain ${className}`}
      style={{ filter: color ? `drop-shadow(0 0 4px ${color}66)` : undefined }}
    />
  );
}
