import { describe, expect, it } from 'vitest';

import {
  ADS_OUTPUT_CONTRACT_V1_TEMPLATE_APPENDIX,
  PRODUCT_EXPERIMENT_PROMPT_DEFAULT_TEMPLATES,
  normalizeProductExperimentPromptTemplates,
} from '../apps/web/src/lib/logbook/productExperimentPromptTemplatesModel';

describe('normalizeProductExperimentPromptTemplates', () => {
  it('returns defaults for null input with exactly one default', () => {
    const normalized = normalizeProductExperimentPromptTemplates(null);
    const defaultCount = normalized.filter((template) => template.is_default).length;

    expect(normalized).toEqual(PRODUCT_EXPERIMENT_PROMPT_DEFAULT_TEMPLATES);
    expect(defaultCount).toBe(1);
  });

  it('enforces only one default when multiple defaults are marked', () => {
    const normalized = normalizeProductExperimentPromptTemplates({
      templates: [
        {
          id: 'alpha',
          name: 'Alpha',
          description: '',
          instructions_md: '',
          is_default: true,
        },
        {
          id: 'beta',
          name: 'Beta',
          description: '',
          instructions_md: '',
          is_default: true,
        },
      ],
    });

    expect(normalized).toHaveLength(2);
    expect(normalized[0].is_default).toBe(true);
    expect(normalized[1].is_default).toBe(false);
  });

  it('fills missing strings and sets first template as default when none flagged', () => {
    const normalized = normalizeProductExperimentPromptTemplates({
      templates: [{ id: 'x', name: 'X' }],
    });

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      id: 'x',
      name: 'X',
      description: '',
      instructions_md: '',
      is_default: true,
    });
  });

  it('includes output contract appendix in default formatting_only and experiment_partner templates', () => {
    const normalized = normalizeProductExperimentPromptTemplates(null);
    const formattingOnly = normalized.find((template) => template.id === 'formatting_only');
    const partner = normalized.find((template) => template.id === 'experiment_partner');

    expect(formattingOnly?.instructions_md).toContain('scope.contract.ads_optimization_v1');
    expect(partner?.instructions_md).toContain('scope.contract.ads_optimization_v1');
    expect(formattingOnly?.instructions_md).toContain(ADS_OUTPUT_CONTRACT_V1_TEMPLATE_APPENDIX.trim());
    expect(partner?.instructions_md).toContain(ADS_OUTPUT_CONTRACT_V1_TEMPLATE_APPENDIX.trim());
  });

  it('appends output contract appendix to settings-provided target templates missing the marker', () => {
    const normalized = normalizeProductExperimentPromptTemplates({
      templates: [
        {
          id: 'formatting_only',
          name: 'Formatting only',
          description: '',
          instructions_md: 'Mode: strict execution.',
          is_default: true,
        },
      ],
    });

    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.instructions_md).toContain('Mode: strict execution.');
    expect(normalized[0]?.instructions_md).toContain('scope.contract.ads_optimization_v1');
    expect(normalized[0]?.instructions_md).toContain(ADS_OUTPUT_CONTRACT_V1_TEMPLATE_APPENDIX.trim());
  });

  it('does not duplicate appendix when settings-provided instructions already include contract marker', () => {
    const existingInstructions = [
      'Mode: strict execution.',
      'When producing final JSON, include experiment.scope.contract.ads_optimization_v1 exactly.',
    ].join('\n');

    const normalized = normalizeProductExperimentPromptTemplates({
      templates: [
        {
          id: 'experiment_partner',
          name: 'Partner mode',
          description: '',
          instructions_md: existingInstructions,
          is_default: true,
        },
      ],
    });

    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.instructions_md).toBe(existingInstructions);
    expect(normalized[0]?.instructions_md).not.toContain('Output Contract V1 requirement:');
  });
});
