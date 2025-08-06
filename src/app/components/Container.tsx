import React from "react";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}

const Container: React.FC<ContainerProps> = ({
  children,
  className = "",
  padding = "px-4 sm:px-6 lg:px-8",
}) => {
  return <div className={`max-w-screen-xl mx-auto ${padding} ${className}`}>{children}</div>;
};

export default Container;

