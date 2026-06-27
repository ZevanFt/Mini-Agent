import { Box, Text } from 'ink';

const LOGO_VARIANTS = {
  compact: {
    mini: [
      '███    ███  ██  ███    ██  ██',
      '████  ████  ██  ████   ██  ██',
      '██ ████ ██  ██  ██ ██  ██  ██',
      '██  ██  ██  ██  ██  ██ ██  ██',
      '██      ██  ██  ██   ████  ██',
    ],
    agent: [
      ' █████     ██████  ███████  ███    ██  ████████',
      '██   ██  ██        ██       ████   ██     ██    ',
      '███████  ██   ███  ██ ███   ██ ██  ██     ██    ',
      '██   ██  ██    ██  ██       ██  ██ ██     ██    ',
      '██   ██   ██████   ███████  ██   ████     ██    ',
    ],
  },
  bold: {
    mini: [
      '███╗   ███╗██╗███╗   ██╗██╗',
      '████╗ ████║██║████╗  ██║██║',
      '██╔████╔██║██║██╔██╗ ██║██║',
      '██║╚██╔╝██║██║██║╚██╗██║██║',
      '██║ ╚═╝ ██║██║██║ ╚████║██║',
      '╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝',
    ],
    agent: [
      ' █████╗  ██████╗ ███████╗███╗   ██╗████████╗',
      '██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝',
      '███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ',
      '██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ',
      '██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ',
      '╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ',
    ],
  },
} as const;

const COLOR_MINI = '#0078d7';
const COLOR_AGENT = '#a0a0a0';

export type LogoVariant = keyof typeof LOGO_VARIANTS;

export interface LogoProps {
  variant?: LogoVariant;
  subtitle?: string;
  subtitleColor?: string;
}

export function Logo({ variant = 'bold', subtitle, subtitleColor = '#666666' }: LogoProps) {
  const { mini, agent } = LOGO_VARIANTS[variant];
  const maxLines = Math.max(mini.length, agent.length);
  const miniWidth = mini[0]?.length || 27;
  const agentWidth = agent[0]?.length || 44;
  const totalWidth = miniWidth + agentWidth;
  const subtitleOffset = miniWidth + 43;

  return (
    <Box flexDirection="column" alignItems="center" marginBottom={1}>
      {subtitle && (
        <Box width={totalWidth}>
          <Text>{' '.repeat(subtitleOffset)}</Text>
          <Text color={subtitleColor}>{subtitle}</Text>
        </Box>
      )}
      {Array.from({ length: maxLines }, (_, i) => (
        <Box key={i}>
          <Text color={COLOR_MINI}>{mini[i] || ''}</Text>
          <Text color={COLOR_AGENT}>{agent[i] || ''}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function getLogoHeight(variant: LogoVariant = 'bold'): number {
  return Math.max(LOGO_VARIANTS[variant].mini.length, LOGO_VARIANTS[variant].agent.length) + 1;
}
