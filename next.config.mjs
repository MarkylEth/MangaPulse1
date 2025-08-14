/** @type {import('next').NextConfig} */

const nextConfig = {
	experimental: {
		turbo: {},
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**",
			},
		],
	},
};

export default nextConfig;
