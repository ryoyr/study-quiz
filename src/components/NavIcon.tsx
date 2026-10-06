import AppIcon from "./AppIcon";

type Props = {
  name: "home" | "learn" | "records" | "manage" | "more";
};

export default function NavIcon({ name }: Props) {
  return <AppIcon name={name} />;
}

