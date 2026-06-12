const fs = require('fs');

let content = fs.readFileSync('utils/translations.ts', 'utf8');

const additionalTexts = {
  es: {
    defaultPagare: "El día[FECHA] Pagaré(mos) solidariamente libre de gastos y sin Presto a su orden, en el domicilio[DOMICILIO] La cantidad de [MONEDA_NOMBRE] [MONTO_LETRAS].\\n\\nPor el valor recibido en[CONCEPTO] A mi entera satisfacción.En caso de que este documento no fuese abonado en el día del vencimiento se constituirá(n) el(los) deudor(res) en mora y sin intimación judicial ni extrajudicial el pago; originando también una pena de ...% mensual con el pago de la pena no se entiende extinguida la obligación principal, además de los intereses y comisiones pactados, que continuarán devengándose hasta el reembolso total del crédito, sin que implique novación, prórroga o espera, a todos los efectos legales acepto(amos) la jurisdicción del juzgado de Paz de la ciudad de Villa Elisa.",
    defaultRecibo: "Recibí de[DEUDOR_NOMBRE] la cantidad de [MONEDA_NOMBRE] [MONTO_LETRAS] por concepto de[CONCEPTO].",
    defaultManual: "Escriba aquí el contenido de su documento..."
  },
  en: {
    defaultPagare: "On [FECHA] I(We) jointly and severally promise to pay free of expenses and without protest to the order of, at [DOMICILIO] The amount of [MONEDA_NOMBRE] [MONTO_LETRAS].\\n\\nFor the value received in [CONCEPTO] to my full satisfaction. In the event this document is not paid on the due date, the debtor(s) will be in default and without judicial or extrajudicial intimation of payment; also originating a penalty of ...% monthly with the payment of the penalty the principal obligation is not considered extinguished, in addition to the agreed interest and commissions, which will continue to accrue until full repayment of the credit, without implying novation, extension or waiting, for all legal purposes I(we) accept the jurisdiction of the Peace Court of the city.",
    defaultRecibo: "Received from [DEUDOR_NOMBRE] the amount of [MONEDA_NOMBRE] [MONTO_LETRAS] for [CONCEPTO].",
    defaultManual: "Write the content of your document here..."
  },
  pt: {
    defaultPagare: "No dia [FECHA] Pagarei(emos) solidariamente livre de despesas e sem protesto à sua ordem, no domicílio [DOMICILIO] A quantia de [MONEDA_NOMBRE] [MONTO_LETRAS].\\n\\nPelo valor recebido em [CONCEPTO] à minha inteira satisfação. Caso este documento não seja pago no dia do vencimento, o(s) devedor(es) será(ão) constituído(s) em mora e sem intimação judicial ou extrajudicial para pagamento; originando também uma pena de ...% mensal com o pagamento da pena não se entende extinta a obrigação principal, além dos juros e comissões pactuados, que continuarão a incidir até o reembolso total do crédito, sem implicar novação, prorrogação ou espera, para todos os efeitos legais aceito(amos) a jurisdição do tribunal de Paz da cidade.",
    defaultRecibo: "Recebi de [DEUDOR_NOMBRE] a quantia de [MONEDA_NOMBRE] [MONTO_LETRAS] referente a [CONCEPTO].",
    defaultManual: "Escreva aqui o conteúdo do seu documento..."
  },
  fr: {
    defaultPagare: "Le [FECHA], je(nous) promets(ons) solidairement de payer sans frais ni protêt à l'ordre de, au domicile [DOMICILIO] La somme de [MONEDA_NOMBRE] [MONTO_LETRAS].\\n\\nPour la valeur reçue en [CONCEPTO] à mon entière satisfaction. Au cas où ce document ne serait pas payé à l'échéance, le(s) débiteur(s) sera(ont) en défaut sans mise en demeure judiciaire ou extrajudiciaire ; entraînant également une pénalité de ...% par mois. Le paiement de la pénalité n'éteint pas l'obligation principale, en plus des intérêts et commissions convenus, qui continueront à courir jusqu'au remboursement total du crédit, sans impliquer novation, prolongation ou attente. Pour tous les effets légaux, j'accepte (nous acceptons) la juridiction du tribunal de paix de la ville.",
    defaultRecibo: "Reçu de [DEUDOR_NOMBRE] la somme de [MONEDA_NOMBRE] [MONTO_LETRAS] pour [CONCEPTO].",
    defaultManual: "Rédigez le contenu de votre document ici..."
  }
};

for (const lang of ['es', 'en', 'pt', 'fr']) {
  const langIndex = content.indexOf(`  ${lang}: {`);
  if (langIndex !== -1) {
    const generatorIndex = content.indexOf(`    generator: {`, langIndex);
    if (generatorIndex !== -1) {
      // Find the end of generator object
      const nextKeyIndex = content.indexOf(`    },`, generatorIndex);
      if (nextKeyIndex !== -1) {
        // Insert the additional texts at the end of generator object
        const insertStr = `,\n      defaultPagare: "${additionalTexts[lang].defaultPagare}",\n      defaultRecibo: "${additionalTexts[lang].defaultRecibo}",\n      defaultManual: "${additionalTexts[lang].defaultManual}"`;
        content = content.slice(0, nextKeyIndex) + insertStr + content.slice(nextKeyIndex);
      }
    }
  }
}

fs.writeFileSync('utils/translations.ts', content, 'utf8');
console.log('Translations for default texts updated.');
